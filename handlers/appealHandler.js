import Appeal from '../models/Appeal.js';
import Ban from '../models/Ban.js';
import User from '../models/User.js';
import ViolationSystem from '../utils/violationSystem.js';
import config from '../config.js';
import { adminPanelKeyboard } from '../utils/keyboards.js';
import { logInfo, logSuccess, logError, logWarning } from '../utils/logger.js';
import Admin from '../models/Admin.js';
import { handleStateInterruption } from '../utils/stateManager.js';

const appealStates = new Map();

export async function handleStartAppeal(bot, msg) {
  const chatId = msg.chat.id;
  
  try {
    const user = await User.findByTelegramId(msg.from.id);
    
    if (!user) {
      await bot.sendMessage(chatId, '❌ حدث خطأ، يرجى المحاولة لاحقاً');
      return;
    }
    
    // التحقق من أن المستخدم محظور
    const userStatus = await ViolationSystem.checkUserStatus(user.id);
    
    if (!userStatus.banStatus || userStatus.banStatus.status !== 'active') {
      await bot.sendMessage(chatId, '⚠️ أنت غير محظور حالياً');
      return;
    }
    
    // التحقق من عدم وجود استئناف معلق
    const hasPending = await Appeal.checkPendingAppeal(user.id);
    
    if (hasPending) {
      await bot.sendMessage(chatId, '⚠️ لديك استئناف معلق بالفعل\n\nيرجى انتظار المراجعة');
      return;
    }
    
    logInfo('APPEAL', `User ${msg.from.id} starting appeal`);
    
    appealStates.set(chatId, {
      userId: user.id,
      banId: userStatus.banStatus.id,
      step: 'awaiting_reason',
      timestamp: Date.now() // ✅ إضافة timestamp
    });
    
    const lang = user.language || 'ar';
    const messages = {
      ar: '📝 **تقديم استئناف**\n\n' +
          `⚠️ أنت محظور حالياً: ${userStatus.banStatus.type === 'permanent' ? 'حظر دائم' : 'حظر مؤقت'}\n` +
          `📋 السبب: ${userStatus.banStatus.reason || 'غير محدد'}\n\n` +
          '💬 اشرح سبب طلب رفع الحظر:',
      en: '📝 **Submit Appeal**\n\n' +
          `⚠️ You are currently banned: ${userStatus.banStatus.type === 'permanent' ? 'Permanent ban' : 'Temporary ban'}\n` +
          `📋 Reason: ${userStatus.banStatus.reason || 'Not specified'}\n\n` +
          '💬 Explain why you want the ban lifted:',
      ru: '📝 **Подать апелляцию**\n\n' +
          `⚠️ Вы заблокированы: ${userStatus.banStatus.type === 'permanent' ? 'Постоянная блокировка' : 'Временная блокировка'}\n` +
          `📋 Причина: ${userStatus.banStatus.reason || 'Не указана'}\n\n` +
          '💬 Объясните, почему вы хотите снять блокировку:'
    };
    
    await bot.sendMessage(chatId, messages[lang], {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [['❌ إلغاء']],
        resize_keyboard: true
      }
    });
  } catch (error) {
    logError('APPEAL', 'Failed to start appeal', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ أثناء تقديم الاستئناف');
  }
}

export async function handleAppealReason(bot, msg) {
  const chatId = msg.chat.id;
  const state = appealStates.get(chatId);
  
  if (!state || state.step !== 'awaiting_reason') return false;
  
  if (msg.text === '❌ إلغاء') {
    appealStates.delete(chatId);
    await bot.sendMessage(chatId, '❌ تم إلغاء الاستئناف');
    return true;
  }
  
  // استخدام الدالة المركزية للتحقق من أزرار القائمة
  if (handleStateInterruption(appealStates, chatId, msg.text, false)) {
    return false;
  }
  
  const reason = msg.text;
  
  if (reason.length < 20) {
    await bot.sendMessage(chatId, '⚠️ يرجى كتابة سبب أطول (20 حرف على الأقل)');
    return true;
  }
  
  logInfo('APPEAL', `User ${msg.from.id} submitted appeal reason`);
  
  try {
    const appealId = await Appeal.create(state.userId, state.banId, reason);
    
    const user = await User.findById(state.userId);
    const lang = user.language || 'ar';
    
    const messages = {
      ar: '✅ **تم تقديم الاستئناف بنجاح!**\n\n' +
          `🆔 رقم الاستئناف: ${appealId}\n\n` +
          '⏳ سيتم مراجعة استئنافك من قبل الإدارة\n' +
          '📧 سيتم إشعارك بالنتيجة قريباً',
      en: '✅ **Appeal submitted successfully!**\n\n' +
          `🆔 Appeal ID: ${appealId}\n\n` +
          '⏳ Your appeal will be reviewed by administration\n' +
          '📧 You will be notified of the result soon',
      ru: '✅ **Апелляция успешно подана!**\n\n' +
          `🆔 ID апелляции: ${appealId}\n\n` +
          '⏳ Ваша апелляция будет рассмотрена администрацией\n' +
          '📧 Вы будете уведомлены о результате в ближайшее время'
    };
    
    await bot.sendMessage(chatId, messages[lang], { parse_mode: 'Markdown' });
    
    // إشعار الأدمن
    const adminIds = await Admin.getAllAdminIds();
    for (const adminId of adminIds) {
      try {
        const keyboard = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ قبول', callback_data: `appeal_approve_${appealId}` },
                { text: '❌ رفض', callback_data: `appeal_reject_${appealId}` }
              ],
              [
                { text: '👤 عرض المستخدم', callback_data: `view_user_${user.telegram_id}` }
              ]
            ]
          }
        };
        
        await bot.sendMessage(
          adminId,
          `🔔 **استئناف جديد**\n\n` +
          `🆔 رقم الاستئناف: ${appealId}\n` +
          `👤 المستخدم: @${user.username || 'مستخدم'} (${user.telegram_id})\n\n` +
          `📝 السبب:\n${reason}`,
          { parse_mode: 'Markdown', ...keyboard }
        );
      } catch (error) {
        logWarning('APPEAL', `Failed to notify admin ${adminId}`);
      }
    }
    
    appealStates.delete(chatId);
    logSuccess('APPEAL', `Appeal ${appealId} created successfully`);
    return true;
  } catch (error) {
    logError('APPEAL', 'Failed to create appeal', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ أثناء تقديم الاستئناف');
    return true;
  }
}

export async function handleAppealReview(bot, query) {
  const chatId = query.message.chat.id;
  const data = query.data;
  const action = data.split('_')[1]; // appeal_approve_id or appeal_reject_id
  const appealId = parseInt(data.split('_')[2]);
  
  const isAdmin = await Admin.isAdmin(query.from.id);
  if (!isAdmin) {
    await bot.answerCallbackQuery(query.id, { text: '❌ غير مصرح لك' });
    return;
  }
  
  logInfo('APPEAL', `Admin ${query.from.id} reviewing appeal ${appealId}: ${action}`);
  
  try {
    const appeal = await Appeal.getById(appealId);
    
    if (!appeal) {
      await bot.answerCallbackQuery(query.id, { text: '❌ الاستئناف غير موجود' });
      return;
    }
    
    if (appeal.status !== 'pending') {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ تمت المراجعة مسبقاً' });
      return;
    }
    
    const reviewer = await User.findByTelegramId(query.from.id);
    
    if (action === 'approve') {
      // قبول الاستئناف - رفع الحظر
      await Appeal.updateStatus(appealId, 'approved', reviewer.id, 'تم قبول الاستئناف');
      await Ban.updateStatus(appeal.ban_id, 'lifted');
      await User.updateBanStatus(appeal.user_id, false);
      
      // إشعار المستخدم
      const user = await User.findById(appeal.user_id);
      const lang = user.language || 'ar';
      
      const messages = {
        ar: '✅ **تم قبول استئنافك!**\n\n' +
            `🆔 رقم الاستئناف: ${appealId}\n\n` +
            '🎉 تم رفع الحظر عنك\n' +
            '⚠️ يرجى الالتزام بقواعد البوت لتجنب الحظر مستقبلاً',
        en: '✅ **Your appeal has been approved!**\n\n' +
            `🆔 Appeal ID: ${appealId}\n\n` +
            '🎉 Your ban has been lifted\n' +
            '⚠️ Please follow bot rules to avoid future bans',
        ru: '✅ **Ваша апелляция одобрена!**\n\n' +
            `🆔 ID апелляции: ${appealId}\n\n` +
            '🎉 Ваша блокировка снята\n' +
            '⚠️ Пожалуйста, соблюдайте правила бота, чтобы избежать блокировок в будущем'
      };
      
      await bot.sendMessage(appeal.user_telegram_id, messages[lang], { parse_mode: 'Markdown' });
      
      await bot.editMessageText(
        query.message.text + '\n\n✅ تم قبول الاستئناف ورفع الحظر',
        { chat_id: chatId, message_id: query.message.message_id }
      );
      
      await bot.answerCallbackQuery(query.id, { text: '✅ تم قبول الاستئناف' });
      
      logSuccess('APPEAL', `Appeal ${appealId} approved by admin ${query.from.id}`);
    } else if (action === 'reject') {
      // رفض الاستئناف
      appealStates.set(chatId, {
        appealId,
        reviewerId: reviewer.id,
        step: 'awaiting_reject_note',
        timestamp: Date.now() // ✅ إضافة timestamp
      });
      
      await bot.sendMessage(
        chatId,
        '❌ رفض الاستئناف\n\n📝 أرسل سبب الرفض:',
        {
          reply_markup: {
            keyboard: [['❌ إلغاء']],
            resize_keyboard: true
          }
        }
      );
      
      await bot.answerCallbackQuery(query.id);
    }
  } catch (error) {
    logError('APPEAL', 'Failed to review appeal', error);
    await bot.answerCallbackQuery(query.id, { text: '❌ حدث خطأ' });
  }
}

export async function handleAppealRejectNote(bot, msg) {
  const chatId = msg.chat.id;
  const state = appealStates.get(chatId);
  
  if (!state || state.step !== 'awaiting_reject_note') return false;
  
  if (msg.text === '❌ إلغاء') {
    appealStates.delete(chatId);
    await bot.sendMessage(chatId, '❌ تم إلغاء العملية', adminPanelKeyboard);
    return true;
  }
  
  // استخدام الدالة المركزية للتحقق من أزرار لوحة التحكم
  if (handleStateInterruption(appealStates, chatId, msg.text, true)) {
    return false;
  }
  
  const note = msg.text;
  
  logInfo('APPEAL', `Admin ${msg.from.id} rejecting appeal ${state.appealId}`);
  
  try {
    const appeal = await Appeal.getById(state.appealId);
    
    await Appeal.updateStatus(state.appealId, 'rejected', state.reviewerId, note);
    
    // إشعار المستخدم
    const user = await User.findById(appeal.user_id);
    const lang = user.language || 'ar';
    
    const messages = {
      ar: '❌ **تم رفض استئنافك**\n\n' +
          `🆔 رقم الاستئناف: ${state.appealId}\n\n` +
          `📝 السبب:\n${note}\n\n` +
          '💡 يمكنك تقديم استئناف جديد لاحقاً',
      en: '❌ **Your appeal has been rejected**\n\n' +
          `🆔 Appeal ID: ${state.appealId}\n\n` +
          `📝 Reason:\n${note}\n\n` +
          '💡 You can submit a new appeal later',
      ru: '❌ **Ваша апелляция отклонена**\n\n' +
          `🆔 ID апелляции: ${state.appealId}\n\n` +
          `📝 Причина:\n${note}\n\n` +
          '💡 Вы можете подать новую апелляцию позже'
    };
    
    await bot.sendMessage(appeal.user_telegram_id, messages[lang], { parse_mode: 'Markdown' });
    
    await bot.sendMessage(chatId, '✅ تم رفض الاستئناف وإشعار المستخدم', adminPanelKeyboard);
    
    appealStates.delete(chatId);
    logSuccess('APPEAL', `Appeal ${state.appealId} rejected`);
    return true;
  } catch (error) {
    logError('APPEAL', 'Failed to reject appeal', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ أثناء رفض الاستئناف');
    return true;
  }
}

export async function handleViewAppeals(bot, msg) {
  const chatId = msg.chat.id;
  
  const isAdmin = await Admin.isAdmin(msg.from.id);
  if (!isAdmin) {
    await bot.sendMessage(chatId, '❌ غير مصرح لك بهذا الأمر');
    return;
  }

  try {
    logInfo('APPEAL', `Admin ${msg.from.id} viewing pending appeals`);
    
    const appeals = await Appeal.getPending();
    
    if (appeals.length === 0) {
      await bot.sendMessage(chatId, '📋 لا توجد استئنافات معلقة');
      return;
    }
    
    let message = '📋 **الاستئنافات المعلقة**\n\n';
    
    appeals.forEach((appeal, i) => {
      message += `${i + 1}. 🆔 ${appeal.id}\n`;
      message += `   👤 @${appeal.user_username || 'مستخدم'}\n`;
      message += `   🚫 ${appeal.ban_type === 'permanent' ? 'حظر دائم' : 'حظر مؤقت'}\n`;
      message += `   📝 ${appeal.reason.substring(0, 50)}${appeal.reason.length > 50 ? '...' : ''}\n`;
      message += `   📅 ${new Date(appeal.created_at).toLocaleDateString('ar')}\n\n`;
    });
    
    await bot.sendMessage(chatId, message, { 
      parse_mode: 'Markdown',
      ...adminPanelKeyboard 
    });
    
    logSuccess('APPEAL', `Sent ${appeals.length} pending appeals`);
  } catch (error) {
    logError('APPEAL', 'Failed to view appeals', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ أثناء عرض الاستئنافات');
  }
}

export { appealStates };
