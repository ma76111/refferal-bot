import User from '../models/User.js';
import Settings from '../models/Settings.js';
import config from '../config.js';
import { adminMenu, getMainMenuKeyboard, languageKeyboard, adminPanelKeyboard } from '../utils/keyboards.js';
import { logInfo, logSuccess, logWarning, logError } from '../utils/logger.js';

const adminStates = new Map();

export async function handleAdminPanel(bot, msg) {
  const chatId = msg.chat.id;
  
  if (!config.ADMIN_IDS.includes(msg.from.id)) {
    await bot.sendMessage(chatId, '❌ غير مصرح لك بهذا الأمر');
    return;
  }

  await bot.sendMessage(
    chatId,
    '⚙️ لوحة تحكم الأدمن\n\nاختر الإجراء المطلوب:',
    adminPanelKeyboard
  );
}

export async function handleSearchUser(bot, msg) {
  const chatId = msg.chat.id;
  
  if (!config.ADMIN_IDS.includes(msg.from.id)) {
    await bot.sendMessage(chatId, '❌ غير مصرح لك بهذا الأمر');
    return;
  }

  adminStates.set(chatId, { step: 'awaiting_search_query' });
  
  await bot.sendMessage(
    chatId,
    '🔍 البحث عن مستخدم\n\nأرسل ID المستخدم أو اليوزرنيم:',
    {
      reply_markup: {
        keyboard: [['❌ إلغاء']],
        resize_keyboard: true
      }
    }
  );
}

export async function handleEditSupportText(bot, msg) {
  const chatId = msg.chat.id;
  
  if (!config.ADMIN_IDS.includes(msg.from.id)) {
    await bot.sendMessage(chatId, '❌ غير مصرح لك بهذا الأمر');
    return;
  }

  await bot.sendMessage(
    chatId,
    '✏️ تعديل نص الدعم\n\nاختر اللغة:',
    languageKeyboard
  );
}

export async function handleAdminSteps(bot, msg) {
  const chatId = msg.chat.id;
  const state = adminStates.get(chatId);
  
  if (!state) return false;

  if (msg.text === '❌ إلغاء') {
    adminStates.delete(chatId);
    await bot.sendMessage(chatId, '❌ تم إلغاء العملية', adminPanelKeyboard);
    return true;
  }

  switch (state.step) {
    case 'awaiting_search_query':
      const users = await User.searchByIdOrUsername(msg.text);
      
      if (users.length === 0) {
        await bot.sendMessage(chatId, '❌ لم يتم العثور على مستخدمين', adminPanelKeyboard);
        adminStates.delete(chatId);
        return true;
      }

      // عرض كل مستخدم مع أزرار التحكم
      for (const user of users) {
        let message = '👤 معلومات المستخدم:\n\n';
        message += `🆔 ID: \`${user.telegram_id}\`\n`;
        message += `👤 اليوزرنيم: ${user.username ? '@' + user.username : 'غير متوفر'}\n`;
        message += `💰 المحفظة: ${user.balance} USDT\n`;
        message += `🌐 اللغة: ${user.language}\n`;
        message += `${user.is_banned ? '🔴 محظور' : '🟢 نشط'}\n`;
        message += `📅 تاريخ التسجيل: ${new Date(user.created_at).toLocaleDateString('ar')}`;

        const keyboard = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '💰 تعديل المحفظة', callback_data: `admin_edit_balance_${user.telegram_id}` },
                { text: user.is_banned ? '✅ إلغاء الحظر' : '🚫 حظر', callback_data: user.is_banned ? `admin_unban_${user.telegram_id}` : `admin_ban_${user.telegram_id}` }
              ]
            ]
          }
        };

        await bot.sendMessage(chatId, message, { ...keyboard, parse_mode: 'Markdown' });
      }

      adminStates.delete(chatId);
      break;

    case 'awaiting_support_text':
      await Settings.setSupportText(state.language, msg.text);
      await bot.sendMessage(
        chatId,
        `✅ تم تحديث نص الدعم للغة ${state.language === 'ar' ? 'العربية' : state.language === 'en' ? 'الإنجليزية' : 'الروسية'}`,
        adminPanelKeyboard
      );
      adminStates.delete(chatId);
      break;

    case 'awaiting_max_count':
      const maxCount = parseInt(msg.text);
      if (isNaN(maxCount) || maxCount <= 0) {
        await bot.sendMessage(chatId, '❌ الرجاء إرسال رقم صحيح');
        return true;
      }
      await Settings.setMaxRequiredCount(maxCount);
      await bot.sendMessage(
        chatId,
        `✅ تم تحديث الحد الأقصى للأشخاص المطلوبين إلى: ${maxCount}`,
        adminPanelKeyboard
      );
      adminStates.delete(chatId);
      break;

    case 'awaiting_max_tasks':
      const maxTasks = parseInt(msg.text);
      if (isNaN(maxTasks) || maxTasks <= 0) {
        await bot.sendMessage(chatId, '❌ الرجاء إرسال رقم صحيح');
        return true;
      }
      await Settings.setMaxTasksPerUser(maxTasks);
      await bot.sendMessage(
        chatId,
        `✅ تم تحديث حد المهام للمستخدم إلى: ${maxTasks}`,
        adminPanelKeyboard
      );
      adminStates.delete(chatId);
      break;

    case 'awaiting_new_balance':
      const newBalance = parseFloat(msg.text);
      if (isNaN(newBalance)) {
        await bot.sendMessage(chatId, '❌ الرجاء إرسال رقم صحيح');
        return true;
      }
      
      await User.setBalance(state.userId, newBalance);
      await bot.sendMessage(
        chatId,
        `✅ تم تحديث محفظة المستخدم إلى: ${newBalance} USDT`,
        adminPanelKeyboard
      );
      adminStates.delete(chatId);
      break;

    case 'awaiting_task_timeout':
      const timeoutMinutes = parseInt(msg.text);
      if (isNaN(timeoutMinutes) || timeoutMinutes <= 0) {
        await bot.sendMessage(chatId, '❌ الرجاء إرسال رقم صحيح (بالدقائق)');
        return true;
      }
      const timeoutSeconds = timeoutMinutes * 60;
      await Settings.setTaskTimeout(timeoutSeconds);
      await bot.sendMessage(
        chatId,
        `✅ تم تحديث وقت المهلة إلى: ${timeoutMinutes} دقيقة`,
        adminPanelKeyboard
      );
      adminStates.delete(chatId);
      break;

    case 'awaiting_improvement_timeout':
      const improvementMinutes = parseInt(msg.text);
      if (isNaN(improvementMinutes) || improvementMinutes <= 0) {
        await bot.sendMessage(chatId, '❌ الرجاء إرسال رقم صحيح (بالدقائق)');
        return true;
      }
      const improvementSeconds = improvementMinutes * 60;
      await Settings.setImprovementTimeout(improvementSeconds);
      await bot.sendMessage(
        chatId,
        `✅ تم تحديث مهلة التحسين إلى: ${improvementMinutes} دقيقة`,
        adminPanelKeyboard
      );
      adminStates.delete(chatId);
      break;

    default:
      return false;
  }

  return true;
}

export async function handleLanguageSelection(bot, query) {
  const chatId = query.message.chat.id;
  const lang = query.data.split('_')[2]; // support_lang_ar

  logInfo('LANGUAGE', `Processing language selection: ${lang} for user ${query.from.id}`);

  if (query.data.startsWith('support_lang_')) {
    adminStates.set(chatId, { step: 'awaiting_support_text', language: lang });
    
    const currentText = await Settings.getSupportText(lang);
    
    await bot.editMessageText(
      `✏️ تعديل نص الدعم (${lang === 'ar' ? 'العربية' : lang === 'en' ? 'الإنجليزية' : 'الروسية'})\n\n` +
      `النص الحالي:\n${currentText}\n\n` +
      `أرسل النص الجديد:`,
      { chat_id: chatId, message_id: query.message.message_id }
    );
    logSuccess('ADMIN', `Admin ${query.from.id} started editing support text for ${lang}`);
  } else if (query.data.startsWith('set_lang_')) {
    let user = await User.findByTelegramId(query.from.id);
    
    // إنشاء المستخدم إذا لم يكن موجوداً
    if (!user) {
      logWarning('LANGUAGE', `User ${query.from.id} not found, creating...`);
      await User.create(query.from.id, query.from.username || query.from.first_name);
      user = await User.findByTelegramId(query.from.id);
    }
    
    logInfo('LANGUAGE', `Setting language to ${lang} for user ${user.id}`);
    await User.setLanguage(user.id, lang);
    logSuccess('LANGUAGE', `Language saved to database: ${lang}`);
    
    const langNames = {
      ar: 'العربية',
      en: 'English',
      ru: 'Русский'
    };
    
    const successMessages = {
      ar: '✅ تم تغيير اللغة إلى العربية',
      en: '✅ Language changed to English',
      ru: '✅ Язык изменен на Русский'
    };
    
    await bot.answerCallbackQuery(query.id, { text: '✅' });
    await bot.editMessageText(
      successMessages[lang],
      { chat_id: chatId, message_id: query.message.message_id }
    );
    
    logSuccess('LANGUAGE', `Language changed to ${lang} for user ${query.from.id}`);
    
    // إرسال القائمة الرئيسية بالللغة الجديدة
    const isAdmin = config.ADMIN_IDS.includes(query.from.id);
    logInfo('LANGUAGE', `User is admin: ${isAdmin}`);
    
    const menu = getMainMenuKeyboard(isAdmin, lang);
    logInfo('LANGUAGE', `Generated menu for language: ${lang}`, menu);
    
    const welcomeMessages = {
      ar: '📋 القائمة الرئيسية',
      en: '📋 Main Menu',
      ru: '📋 Главное меню'
    };
    
    logInfo('LANGUAGE', `Sending menu message: "${welcomeMessages[lang]}"`);
    await bot.sendMessage(chatId, welcomeMessages[lang], menu);
    logSuccess('LANGUAGE', `Menu sent successfully in ${lang} to user ${query.from.id}`);
  }
}

export { adminStates };
