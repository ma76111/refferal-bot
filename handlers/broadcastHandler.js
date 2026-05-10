import Broadcast from '../models/Broadcast.js';
import User from '../models/User.js';
import config from '../config.js';
import { adminPanelKeyboard } from '../utils/keyboards.js';
import { logInfo, logSuccess, logError, logWarning } from '../utils/logger.js';
import Admin from '../models/Admin.js';
import { handleStateInterruption } from '../utils/stateManager.js';

const broadcastStates = new Map();

export async function handleStartBroadcast(bot, msg) {
  const chatId = msg.chat.id;
  
  const isAdmin = await Admin.isAdmin(msg.from.id);
  if (!isAdmin) {
    await bot.sendMessage(chatId, '❌ غير مصرح لك بهذا الأمر');
    return;
  }

  logInfo('BROADCAST', `Admin ${msg.from.id} starting broadcast`);
  
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📢 جميع المستخدمين', callback_data: 'broadcast_target_all' }],
        [{ text: '✅ المستخدمون النشطون فقط', callback_data: 'broadcast_target_active' }],
        [{ text: '🚫 المستخدمون المحظورون فقط', callback_data: 'broadcast_target_banned' }],
        [{ text: '❌ إلغاء', callback_data: 'cancel' }]
      ]
    }
  };
  
  await bot.sendMessage(
    chatId,
    '📢 **إرسال رسالة جماعية**\n\n' +
    'اختر الفئة المستهدفة:',
    { parse_mode: 'Markdown', ...keyboard }
  );
}

export async function handleBroadcastTarget(bot, query) {
  const chatId = query.message.chat.id;
  const target = query.data.split('_')[2]; // broadcast_target_all
  
  logInfo('BROADCAST', `Admin ${query.from.id} selected target: ${target}`);
  
  broadcastStates.set(chatId, {
    adminId: query.from.id,
    target,
    step: 'awaiting_message',
    timestamp: Date.now() // ✅ إضافة timestamp
  });
  
  const targetNames = {
    all: 'جميع المستخدمين',
    active: 'المستخدمون النشطون',
    banned: 'المستخدمون المحظورون'
  };
  
  await bot.editMessageText(
    `📢 **إرسال رسالة جماعية**\n\n` +
    `🎯 الفئة: ${targetNames[target]}\n\n` +
    `📝 أرسل الرسالة الآن:`,
    {
      chat_id: chatId,
      message_id: query.message.message_id,
      parse_mode: 'Markdown'
    }
  );
  
  await bot.answerCallbackQuery(query.id);
}

export async function handleBroadcastMessage(bot, msg) {
  const chatId = msg.chat.id;
  const state = broadcastStates.get(chatId);
  
  if (!state || state.step !== 'awaiting_message') return false;
  
  if (msg.text === '❌ إلغاء') {
    broadcastStates.delete(chatId);
    await bot.sendMessage(chatId, '❌ تم إلغاء الرسالة الجماعية', adminPanelKeyboard);
    return true;
  }
  
  // استخدام الدالة المركزية للتحقق من أزرار لوحة التحكم
  if (handleStateInterruption(broadcastStates, chatId, msg.text, true)) {
    return false;
  }
  
  const message = msg.text;
  
  logInfo('BROADCAST', `Admin ${msg.from.id} provided message: ${message.substring(0, 50)}...`);
  
  try {
    const user = await User.findByTelegramId(state.adminId);
    
    // إنشاء الرسالة الجماعية
    const broadcastId = await Broadcast.create(user.id, message, state.target);
    
    // تأكيد من الأدمن
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ إرسال الآن', callback_data: `broadcast_send_${broadcastId}` },
            { text: '❌ إلغاء', callback_data: `broadcast_cancel_${broadcastId}` }
          ]
        ]
      }
    };
    
    const targetNames = {
      all: 'جميع المستخدمين',
      active: 'المستخدمون النشطون',
      banned: 'المستخدمون المحظورون'
    };
    
    await bot.sendMessage(
      chatId,
      `📢 **معاينة الرسالة الجماعية**\n\n` +
      `🎯 الفئة: ${targetNames[state.target]}\n\n` +
      `📝 الرسالة:\n${message}\n\n` +
      `⚠️ هل تريد إرسال هذه الرسالة؟`,
      { parse_mode: 'Markdown', ...keyboard }
    );
    
    broadcastStates.delete(chatId);
    return true;
  } catch (error) {
    logError('BROADCAST', 'Failed to create broadcast', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ أثناء إنشاء الرسالة');
    return true;
  }
}

export async function handleBroadcastSend(bot, query) {
  const chatId = query.message.chat.id;
  const broadcastId = parseInt(query.data.split('_')[2]);
  
  logInfo('BROADCAST', `Admin ${query.from.id} confirmed broadcast ${broadcastId}`);
  
  try {
    const broadcast = await Broadcast.getById(broadcastId);
    
    if (!broadcast) {
      await bot.answerCallbackQuery(query.id, { text: '❌ الرسالة غير موجودة' });
      return;
    }
    
    await bot.editMessageText(
      `⏳ جاري إرسال الرسالة الجماعية...\n\n` +
      `📊 سيتم تحديث الحالة تلقائياً`,
      {
        chat_id: chatId,
        message_id: query.message.message_id
      }
    );
    
    await bot.answerCallbackQuery(query.id, { text: '⏳ جاري الإرسال...' });
    
    // تحديث الحالة إلى "sending"
    await Broadcast.updateStatus(broadcastId, 'sending');
    
    // الحصول على المستخدمين المستهدفين
    let users = [];
    if (broadcast.target_type === 'all') {
      users = await User.getAll();
    } else if (broadcast.target_type === 'active') {
      users = await User.getActive();
    } else if (broadcast.target_type === 'banned') {
      users = await User.getBanned();
    }
    
    logInfo('BROADCAST', `Sending to ${users.length} users`);
    
    let sentCount = 0;
    let failedCount = 0;
    
    // إرسال الرسالة لكل مستخدم
    for (const user of users) {
      try {
        await bot.sendMessage(user.telegram_id, broadcast.message);
        sentCount++;
        
        // تأخير صغير لتجنب حدود Telegram
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        failedCount++;
        logWarning('BROADCAST', `Failed to send to user ${user.telegram_id}: ${error.message}`);
      }
    }
    
    // تحديث الحالة إلى "completed"
    await Broadcast.updateStatus(broadcastId, 'completed', sentCount, failedCount);
    
    await bot.sendMessage(
      chatId,
      `✅ **تم إرسال الرسالة الجماعية!**\n\n` +
      `📊 الإحصائيات:\n` +
      `├ تم الإرسال: ${sentCount}\n` +
      `├ فشل: ${failedCount}\n` +
      `└ الإجمالي: ${users.length}`,
      { parse_mode: 'Markdown', ...adminPanelKeyboard }
    );
    
    logSuccess('BROADCAST', `Broadcast ${broadcastId} completed: ${sentCount} sent, ${failedCount} failed`);
  } catch (error) {
    logError('BROADCAST', 'Failed to send broadcast', error);
    await Broadcast.updateStatus(broadcastId, 'failed');
    await bot.sendMessage(chatId, '❌ حدث خطأ أثناء إرسال الرسالة');
  }
}

export async function handleBroadcastCancel(bot, query) {
  const broadcastId = parseInt(query.data.split('_')[2]);
  
  logInfo('BROADCAST', `Admin ${query.from.id} cancelled broadcast ${broadcastId}`);
  
  try {
    await Broadcast.delete(broadcastId);
    
    await bot.editMessageText(
      '❌ تم إلغاء الرسالة الجماعية',
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id
      }
    );
    
    await bot.answerCallbackQuery(query.id, { text: '❌ تم الإلغاء' });
    
    logSuccess('BROADCAST', `Broadcast ${broadcastId} cancelled`);
  } catch (error) {
    logError('BROADCAST', 'Failed to cancel broadcast', error);
    await bot.answerCallbackQuery(query.id, { text: '❌ حدث خطأ' });
  }
}

export async function handleBroadcastHistory(bot, msg) {
  const chatId = msg.chat.id;
  
  const isAdmin = await Admin.isAdmin(msg.from.id);
  if (!isAdmin) {
    await bot.sendMessage(chatId, '❌ غير مصرح لك بهذا الأمر');
    return;
  }

  try {
    logInfo('BROADCAST', `Admin ${msg.from.id} requested broadcast history`);
    
    const broadcasts = await Broadcast.getAll(10);
    
    if (broadcasts.length === 0) {
      await bot.sendMessage(chatId, '📢 لا توجد رسائل جماعية سابقة');
      return;
    }
    
    let message = '📢 **سجل الرسائل الجماعية**\n\n';
    
    broadcasts.forEach((b, i) => {
      const statusEmoji = {
        pending: '⏳',
        sending: '📤',
        completed: '✅',
        failed: '❌'
      };
      
      const targetNames = {
        all: 'الجميع',
        active: 'النشطون',
        banned: 'المحظورون'
      };
      
      message += `${i + 1}. ${statusEmoji[b.status]} ${targetNames[b.target_type]}\n`;
      message += `   📝 ${b.message.substring(0, 50)}${b.message.length > 50 ? '...' : ''}\n`;
      message += `   📊 إرسال: ${b.sent_count || 0} | فشل: ${b.failed_count || 0}\n`;
      message += `   📅 ${new Date(b.created_at).toLocaleDateString('ar')}\n\n`;
    });
    
    await bot.sendMessage(chatId, message, { 
      parse_mode: 'Markdown',
      ...adminPanelKeyboard 
    });
    
    logSuccess('BROADCAST', 'Broadcast history sent');
  } catch (error) {
    logError('BROADCAST', 'Failed to get broadcast history', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ أثناء جلب السجل');
  }
}

export { broadcastStates };
