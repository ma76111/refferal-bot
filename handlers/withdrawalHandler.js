import Withdrawal from '../models/Withdrawal.js';
import User from '../models/User.js';
import Settings from '../models/Settings.js';
import config from '../config.js';
import { logInfo, logSuccess, logError, logWarning, logCallback } from '../utils/logger.js';
import { depositMethodKeyboard, cancelKeyboard, mainMenu, adminMenu } from '../utils/keyboards.js';

const withdrawalStates = new Map();
const MIN_WITHDRAWAL = 1; // الحد الأدنى للسحب

export async function handleStartWithdrawal(bot, msg) {
  const chatId = msg.chat.id;
  const user = await User.findByTelegramId(msg.from.id);
  
  logInfo('WITHDRAWAL', `User ${msg.from.id} initiated withdrawal flow`);
  
  if (!user) {
    logWarning('WITHDRAWAL', `User ${msg.from.id} not found`);
    return;
  }

  const balance = await User.getBalance(user.id);
  const lang = user.language || 'ar';

  if (balance < MIN_WITHDRAWAL) {
    const messages = {
      ar: `❌ رصيدك غير كافٍ للسحب\n\n👛 رصيدك الحالي: ${balance.toFixed(2)} USDT\n💰 الحد الأدنى للسحب: ${MIN_WITHDRAWAL} USDT`,
      en: `❌ Insufficient balance for withdrawal\n\n👛 Your current balance: ${balance.toFixed(2)} USDT\n💰 Minimum withdrawal: ${MIN_WITHDRAWAL} USDT`,
      ru: `❌ Недостаточно средств для вывода\n\n👛 Ваш текущий баланс: ${balance.toFixed(2)} USDT\n💰 Минимальный вывод: ${MIN_WITHDRAWAL} USDT`
    };
    await bot.sendMessage(chatId, messages[lang]);
    return;
  }

  const selectMethodMessages = {
    ar: `💸 سحب USDT\n\n👛 رصيدك: ${balance.toFixed(2)} USDT\n💰 الحد الأدنى للسحب: ${MIN_WITHDRAWAL} USDT\n\nاختر طريقة السحب:`,
    en: `💸 Withdraw USDT\n\n👛 Your balance: ${balance.toFixed(2)} USDT\n💰 Minimum withdrawal: ${MIN_WITHDRAWAL} USDT\n\nSelect withdrawal method:`,
    ru: `💸 Вывод USDT\n\n👛 Ваш баланс: ${balance.toFixed(2)} USDT\n💰 Минимальный вывод: ${MIN_WITHDRAWAL} USDT\n\nВыберите способ вывода:`
  };

  await bot.sendMessage(chatId, selectMethodMessages[lang], depositMethodKeyboard);
}

export async function handleWithdrawalMethod(bot, query) {
  const chatId = query.message.chat.id;
  const user = await User.findByTelegramId(query.from.id);
  
  if (!user) {
    logWarning('WITHDRAWAL', `User ${query.from.id} not found`);
    return;
  }

  const method = query.data === 'withdrawal_binance_id' ? 'binance_id' : 'wallet';
  const lang = user.language || 'ar';
  logCallback(query.data, query.from.id, query.from.username);

  withdrawalStates.set(chatId, {
    userId: user.id,
    telegramId: query.from.id,
    method,
    step: 'awaiting_amount',
    lang
  });

  const messages = {
    ar: method === 'binance_id' 
      ? '💸 السحب عبر Binance Pay ID\n\n💰 أرسل المبلغ بالـ USDT (الحد الأدنى: 1):'
      : '💸 السحب عبر عنوان المحفظة\n\n💰 أرسل المبلغ بالـ USDT (الحد الأدنى: 1):',
    en: method === 'binance_id'
      ? '💸 Withdraw via Binance Pay ID\n\n💰 Send amount in USDT (minimum: 1):'
      : '💸 Withdraw via Wallet Address\n\n💰 Send amount in USDT (minimum: 1):',
    ru: method === 'binance_id'
      ? '💸 Вывод через Binance Pay ID\n\n💰 Отправьте сумму в USDT (минимум: 1):'
      : '💸 Вывод через адрес кошелька\n\n💰 Отправьте сумму в USDT (минимум: 1):'
  };

  await bot.editMessageText(messages[lang], {
    chat_id: chatId,
    message_id: query.message.message_id
  });
}

export async function handleWithdrawalSteps(bot, msg) {
  const chatId = msg.chat.id;
  const state = withdrawalStates.get(chatId);
  
  if (!state) return false;

  const lang = state.lang || 'ar';

  if (msg.text === '❌ إلغاء') {
    withdrawalStates.delete(chatId);
    const isAdmin = config.ADMIN_IDS.includes(msg.from.id);
    const cancelMessages = {
      ar: '❌ تم إلغاء العملية',
      en: '❌ Operation cancelled',
      ru: '❌ Операция отменена'
    };
    await bot.sendMessage(chatId, cancelMessages[lang], isAdmin ? adminMenu : mainMenu);
    return true;
  }

  switch (state.step) {
    case 'awaiting_amount':
      const amount = parseFloat(msg.text);
      logInfo('WITHDRAWAL', `Amount received: ${amount} USDT from user ${msg.from.id}`);
      
      if (isNaN(amount) || amount < MIN_WITHDRAWAL) {
        const messages = {
          ar: `❌ المبلغ غير صحيح. الحد الأدنى: ${MIN_WITHDRAWAL} USDT`,
          en: `❌ Invalid amount. Minimum: ${MIN_WITHDRAWAL} USDT`,
          ru: `❌ Неверная сумма. Минимум: ${MIN_WITHDRAWAL} USDT`
        };
        await bot.sendMessage(chatId, messages[lang]);
        return true;
      }

      // التحقق من الرصيد
      const balance = await User.getBalance(state.userId);
      if (amount > balance) {
        const messages = {
          ar: `❌ رصيدك غير كافٍ\n\n👛 رصيدك: ${balance.toFixed(2)} USDT\n💸 المبلغ المطلوب: ${amount} USDT`,
          en: `❌ Insufficient balance\n\n👛 Your balance: ${balance.toFixed(2)} USDT\n💸 Requested amount: ${amount} USDT`,
          ru: `❌ Недостаточно средств\n\n👛 Ваш баланс: ${balance.toFixed(2)} USDT\n💸 Запрошенная сумма: ${amount} USDT`
        };
        await bot.sendMessage(chatId, messages[lang]);
        return true;
      }
      
      state.amount = amount;
      logSuccess('WITHDRAWAL', `Amount accepted: ${amount} USDT`);
      
      if (state.method === 'binance_id') {
        state.step = 'awaiting_binance_id';
        const messages = {
          ar: '🆔 أرسل Binance Pay ID الخاص بك:',
          en: '🆔 Send your Binance Pay ID:',
          ru: '🆔 Отправьте ваш Binance Pay ID:'
        };
        await bot.sendMessage(chatId, messages[lang], cancelKeyboard);
      } else {
        state.step = 'awaiting_wallet_address';
        const messages = {
          ar: '📍 أرسل عنوان محفظتك (USDT):',
          en: '📍 Send your wallet address (USDT):',
          ru: '📍 Отправьте адрес вашего кошелька (USDT):'
        };
        await bot.sendMessage(chatId, messages[lang], cancelKeyboard);
      }
      break;

    case 'awaiting_binance_id':
      state.binanceId = msg.text;
      state.step = 'awaiting_screenshot';
      const screenshotMessages = {
        ar: '📸 أرسل صورة (سكرين) لـ Binance Pay ID:',
        en: '📸 Send screenshot of Binance Pay ID:',
        ru: '📸 Отправьте скриншот Binance Pay ID:'
      };
      await bot.sendMessage(chatId, screenshotMessages[lang], cancelKeyboard);
      break;

    case 'awaiting_screenshot':
      if (!msg.photo) {
        const messages = {
          ar: '❌ الرجاء إرسال صورة',
          en: '❌ Please send an image',
          ru: '❌ Пожалуйста, отправьте изображение'
        };
        await bot.sendMessage(chatId, messages[lang]);
        return true;
      }

      const photo = msg.photo[msg.photo.length - 1];
      state.screenshotId = photo.file_id;

      try {
        logInfo('WITHDRAWAL', `Creating request: ${state.amount} USDT via Binance Pay ID`);
        
        // خصم المبلغ من الرصيد
        await User.updateBalance(state.userId, -state.amount);
        
        const withdrawalId = await Withdrawal.create({
          userId: state.userId,
          amount: state.amount,
          method: state.method,
          binanceId: state.binanceId,
          walletAddress: null,
          network: null,
          screenshotId: state.screenshotId
        });

        logSuccess('WITHDRAWAL', `Request created with ID: ${withdrawalId}`);

        const isAdmin = config.ADMIN_IDS.includes(msg.from.id);
        const successMessages = {
          ar: `✅ تم إرسال طلب السحب بنجاح!\n\n💰 المبلغ: ${state.amount} USDT\n🆔 رقم الطلب: ${withdrawalId}\n\n⏳ سيتم مراجعة طلبك قريباً\n\n📝 ملاحظة: تم خصم المبلغ من رصيدك`,
          en: `✅ Withdrawal request sent successfully!\n\n💰 Amount: ${state.amount} USDT\n🆔 Request ID: ${withdrawalId}\n\n⏳ Your request will be reviewed soon\n\n📝 Note: Amount has been deducted from your balance`,
          ru: `✅ Запрос на вывод успешно отправлен!\n\n💰 Сумма: ${state.amount} USDT\n🆔 ID запроса: ${withdrawalId}\n\n⏳ Ваш запрос скоро будет рассмотрен\n\n📝 Примечание: Сумма списана с вашего баланса`
        };
        
        await bot.sendMessage(chatId, successMessages[lang], isAdmin ? adminMenu : mainMenu);

        // إشعار المسؤولين
        await notifyAdminsWithdrawal(bot, withdrawalId, state);

        withdrawalStates.delete(chatId);
      } catch (error) {
        logError('WITHDRAWAL', 'Failed to create withdrawal (Binance)', error);
        const errorMessages = {
          ar: '❌ حدث خطأ أثناء إرسال الطلب',
          en: '❌ Error occurred while sending request',
          ru: '❌ Произошла ошибка при отправке запроса'
        };
        await bot.sendMessage(chatId, errorMessages[lang]);
      }
      break;

    case 'awaiting_wallet_address':
      state.walletAddress = msg.text;
      state.step = 'awaiting_network';
      const networkMessages = {
        ar: '🌐 أرسل الشبكة (مثال: BSC, TRC20, ERC20):',
        en: '🌐 Send network (example: BSC, TRC20, ERC20):',
        ru: '🌐 Отправьте сеть (пример: BSC, TRC20, ERC20):'
      };
      await bot.sendMessage(chatId, networkMessages[lang], cancelKeyboard);
      break;

    case 'awaiting_network':
      state.network = msg.text.toUpperCase();

      try {
        logInfo('WITHDRAWAL', `Creating request: ${state.amount} USDT to ${state.walletAddress}`);
        
        // خصم المبلغ من الرصيد
        await User.updateBalance(state.userId, -state.amount);
        
        const withdrawalId = await Withdrawal.create({
          userId: state.userId,
          amount: state.amount,
          method: state.method,
          binanceId: null,
          walletAddress: state.walletAddress,
          network: state.network,
          screenshotId: null
        });

        logSuccess('WITHDRAWAL', `Request created with ID: ${withdrawalId}`);

        const isAdmin = config.ADMIN_IDS.includes(msg.from.id);
        const successMessages = {
          ar: `✅ تم إرسال طلب السحب بنجاح!\n\n💰 المبلغ: ${state.amount} USDT\n📍 العنوان: ${state.walletAddress}\n🌐 الشبكة: ${state.network}\n🆔 رقم الطلب: ${withdrawalId}\n\n⏳ سيتم مراجعة طلبك قريباً\n\n📝 ملاحظة: تم خصم المبلغ من رصيدك`,
          en: `✅ Withdrawal request sent successfully!\n\n💰 Amount: ${state.amount} USDT\n📍 Address: ${state.walletAddress}\n🌐 Network: ${state.network}\n🆔 Request ID: ${withdrawalId}\n\n⏳ Your request will be reviewed soon\n\n📝 Note: Amount has been deducted from your balance`,
          ru: `✅ Запрос на вывод успешно отправлен!\n\n💰 Сумма: ${state.amount} USDT\n📍 Адрес: ${state.walletAddress}\n🌐 Сеть: ${state.network}\n🆔 ID запроса: ${withdrawalId}\n\n⏳ Ваш запрос скоро будет рассмотрен\n\n📝 Примечание: Сумма списана с вашего баланса`
        };
        
        await bot.sendMessage(chatId, successMessages[lang], isAdmin ? adminMenu : mainMenu);

        // إشعار المسؤولين
        await notifyAdminsWithdrawal(bot, withdrawalId, state);

        withdrawalStates.delete(chatId);
      } catch (error) {
        logError('WITHDRAWAL', 'Failed to create withdrawal (Wallet)', error);
        const errorMessages = {
          ar: '❌ حدث خطأ أثناء إرسال الطلب',
          en: '❌ Error occurred while sending request',
          ru: '❌ Произошла ошибка при отправке запроса'
        };
        await bot.sendMessage(chatId, errorMessages[lang]);
      }
      break;

    default:
      return false;
  }

  withdrawalStates.set(chatId, state);
  return true;
}

async function notifyAdminsWithdrawal(bot, withdrawalId, state) {
  logInfo('WITHDRAWAL', `Notifying admins about withdrawal ${withdrawalId}`);
  
  let message = '🔔 طلب سحب جديد\n\n';
  message += `🆔 رقم الطلب: ${withdrawalId}\n`;
  message += `💰 المبلغ: ${state.amount} USDT\n`;
  message += `📍 الطريقة: ${state.method === 'binance_id' ? 'Binance Pay ID' : 'عنوان المحفظة'}\n\n`;
  
  if (state.method === 'binance_id') {
    message += `🆔 Binance Pay ID: ${state.binanceId}\n`;
  } else {
    message += `📍 العنوان: ${state.walletAddress}\n`;
    message += `🌐 الشبكة: ${state.network}\n`;
  }

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ تم الإرسال', callback_data: `withdrawal_complete_${withdrawalId}` },
          { text: '❌ رفض', callback_data: `withdrawal_reject_${withdrawalId}` }
        ]
      ]
    }
  };

  for (const adminId of config.ADMIN_IDS) {
    try {
      await bot.sendMessage(adminId, message, keyboard);
      
      if (state.screenshotId) {
        await bot.sendPhoto(adminId, state.screenshotId, {
          caption: '📸 صورة Binance Pay ID'
        });
      }
      logSuccess('WITHDRAWAL', `Admin ${adminId} notified about withdrawal ${withdrawalId}`);
    } catch (error) {
      logError('WITHDRAWAL', `Failed to notify admin ${adminId}`, error);
    }
  }
}

export async function handleWithdrawalReview(bot, query) {
  const data = query.data;
  const reviewerId = query.from.id;

  logCallback(data, reviewerId, query.from.username);

  if (!config.ADMIN_IDS.includes(reviewerId)) {
    logWarning('WITHDRAWAL', `Unauthorized review attempt by ${reviewerId}`);
    await bot.answerCallbackQuery(query.id, { text: '❌ غير مصرح لك' });
    return;
  }

  if (data.startsWith('withdrawal_complete_')) {
    const withdrawalId = parseInt(data.split('_')[2]);
    logInfo('WITHDRAWAL', `Processing completion: ${withdrawalId}`);
    
    const withdrawal = await Withdrawal.getById(withdrawalId);
    
    if (!withdrawal) {
      logWarning('WITHDRAWAL', `Withdrawal ${withdrawalId} not found`);
      await bot.answerCallbackQuery(query.id, { text: '❌ الطلب غير موجود' });
      return;
    }

    if (withdrawal.status !== 'pending') {
      logWarning('WITHDRAWAL', `Withdrawal ${withdrawalId} already reviewed (${withdrawal.status})`);
      await bot.answerCallbackQuery(query.id, { text: '⚠️ تمت المراجعة مسبقاً' });
      return;
    }

    const user = await User.findByTelegramId(reviewerId);
    await Withdrawal.updateStatus(withdrawalId, 'completed', user.id);

    logSuccess('WITHDRAWAL', `Withdrawal ${withdrawalId} completed`);

    await bot.sendMessage(
      withdrawal.user_telegram_id,
      `✅ تم إرسال مبلغ السحب!\n\n` +
      `🆔 رقم الطلب: ${withdrawalId}\n` +
      `💰 المبلغ: ${withdrawal.amount} USDT\n\n` +
      `تم إرسال المبلغ بنجاح`
    );

    await bot.editMessageText(
      query.message.text + '\n\n✅ تم الإرسال',
      { chat_id: query.message.chat.id, message_id: query.message.message_id }
    );

    await bot.answerCallbackQuery(query.id, { text: '✅ تم تأكيد الإرسال' });
  } else if (data.startsWith('withdrawal_reject_')) {
    const withdrawalId = parseInt(data.split('_')[2]);
    logInfo('WITHDRAWAL', `Initiating rejection flow for: ${withdrawalId}`);
    
    withdrawalRejectStates.set(query.message.chat.id, { withdrawalId });
    
    await bot.sendMessage(
      query.message.chat.id,
      '❌ رفض طلب السحب\n\n📝 أرسل سبب الرفض:',
      {
        reply_markup: {
          keyboard: [['❌ إلغاء']],
          resize_keyboard: true
        }
      }
    );

    await bot.answerCallbackQuery(query.id);
  }
}

const withdrawalRejectStates = new Map();

export async function handleWithdrawalRejectReason(bot, msg) {
  const chatId = msg.chat.id;
  const state = withdrawalRejectStates.get(chatId);
  
  if (!state) return false;

  if (msg.text === '❌ إلغاء') {
    logInfo('WITHDRAWAL', `Rejection cancelled by admin ${msg.from.id}`);
    withdrawalRejectStates.delete(chatId);
    await bot.sendMessage(chatId, '❌ تم إلغاء العملية', adminMenu);
    return true;
  }

  const reason = msg.text;
  logInfo('WITHDRAWAL', `Rejection reason for ${state.withdrawalId}: ${reason}`);
  
  const withdrawal = await Withdrawal.getById(state.withdrawalId);
  
  if (!withdrawal) {
    logWarning('WITHDRAWAL', `Withdrawal ${state.withdrawalId} not found`);
    await bot.sendMessage(chatId, '❌ الطلب غير موجود');
    withdrawalRejectStates.delete(chatId);
    return true;
  }

  const user = await User.findByTelegramId(msg.from.id);
  await Withdrawal.updateStatus(state.withdrawalId, 'rejected', user.id, reason);

  // إعادة المبلغ للمستخدم
  await User.updateBalance(withdrawal.user_id, withdrawal.amount);

  logSuccess('WITHDRAWAL', `Withdrawal ${state.withdrawalId} rejected by admin ${msg.from.id}`);

  const supportText = await Settings.getSupportText('ar');
  
  await bot.sendMessage(
    withdrawal.user_telegram_id,
    `❌ تم رفض طلب السحب\n\n` +
    `🆔 رقم الطلب: ${state.withdrawalId}\n` +
    `💰 المبلغ: ${withdrawal.amount} USDT\n\n` +
    `📝 السبب: ${reason}\n\n` +
    `💰 تم إعادة المبلغ إلى محفظتك\n\n` +
    `إذا كنت تعتقد أن هناك مشكلة، يرجى التواصل مع الدعم:\n${supportText}`
  );

  await bot.sendMessage(chatId, '✅ تم رفض الطلب وإرسال الإشعار للمستخدم', adminMenu);
  
  withdrawalRejectStates.delete(chatId);
  return true;
}

export { withdrawalStates, withdrawalRejectStates };
