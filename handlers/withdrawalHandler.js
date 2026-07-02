import User from '../models/User.js';
import Withdrawal from '../models/Withdrawal.js';
import Admin from '../models/Admin.js';
import Settings from '../models/Settings.js';
import { logInfo, logSuccess, logError } from '../utils/logger.js';
import { mainMenu, adminMenu, cancelKeyboard } from '../utils/keyboards.js';

const withdrawalStates = new Map();
const withdrawalRejectStates = new Map();

export async function handleStartWithdrawal(bot, msg) {
  const chatId = msg.chat.id;
  const user = await User.findByTelegramId(msg.from.id);
  
  if (!user) return;

  const lang = user.language || 'ar';
  const balance = await User.getBalance(user.id);
  const minWithdrawal = await Settings.getMinWithdrawal();

  if (balance < minWithdrawal) {
    const messages = {
      ar: `❌ رصيدك غير كافٍ للسحب\n\n👛 رصيدك: ${balance.toFixed(2)} USDT\n💸 الحد الأدنى للسحب: ${minWithdrawal} USDT`,
      en: `❌ Your balance is insufficient for withdrawal\n\n👛 Your balance: ${balance.toFixed(2)} USDT\n💸 Minimum withdrawal: ${minWithdrawal} USDT`,
      ru: `❌ Ваш баланс недостаточен для вывода\n\n👛 Ваш баланс: ${balance.toFixed(2)} USDT\n💸 Минимальный вывод: ${minWithdrawal} USDT`
    };
    await bot.sendMessage(chatId, messages[lang]);
    return;
  }

  withdrawalStates.set(chatId, {
    userId: user.id,
    step: 'awaiting_amount',
    lang
  });

  const messages = {
    ar: `💸 سحب الرصيد\n\n👛 رصيدك المتاح: ${balance.toFixed(2)} USDT\n💸 الحد الأدنى: ${minWithdrawal} USDT\n\nأرسل المبلغ الذي تريد سحبه:`,
    en: `💸 Withdraw Balance\n\n👛 Available balance: ${balance.toFixed(2)} USDT\n💸 Minimum: ${minWithdrawal} USDT\n\nSend the amount you want to withdraw:`,
    ru: `💸 Вывод баланса\n\n👛 Доступный баланс: ${balance.toFixed(2)} USDT\n💸 Минимум: ${minWithdrawal} USDT\n\nОтправьте сумму, которую хотите вывести:`
  };

  await bot.sendMessage(chatId, messages[lang], cancelKeyboard);
}

export async function handleWithdrawalMethod(bot, query) {
  const chatId = query.message.chat.id;
  const state = withdrawalStates.get(chatId);
  
  if (!state) return;

  const method = query.data.replace('withdraw_method_', '');
  state.method = method;
  state.step = method === 'binance_id' ? 'awaiting_binance_id' : 'awaiting_wallet_address';
  
  const lang = state.lang || 'ar';
  
  if (method === 'binance_id') {
    const messages = {
      ar: '🆔 أرسل Binance Pay ID الخاص بك:',
      en: '🆔 Send your Binance Pay ID:',
      ru: '🆔 Отправьте ваш Binance Pay ID:'
    };
    await bot.editMessageText(messages[lang], {
      chat_id: chatId,
      message_id: query.message.message_id
    });
  } else {
    const messages = {
      ar: '📍 أرسل عنوان محفظة USDT (BEP20/TRC20):',
      en: '📍 Send your USDT wallet address (BEP20/TRC20):',
      ru: '📍 Отправьте ваш адрес кошелька USDT (BEP20/TRC20):'
    };
    await bot.editMessageText(messages[lang], {
      chat_id: chatId,
      message_id: query.message.message_id
    });
  }
  
  await bot.answerCallbackQuery(query.id);
}

export async function handleWithdrawalSteps(bot, msg) {
  const chatId = msg.chat.id;
  const state = withdrawalStates.get(chatId);
  
  if (!state) return false;

  const lang = state.lang || 'ar';

  if (msg.text === '❌ إلغاء' || msg.text === '❌ Cancel' || msg.text === '❌ Отмена') {
    withdrawalStates.delete(chatId);
    await bot.sendMessage(chatId, '❌ تم إلغاء العملية', mainMenu);
    return true;
  }

  switch (state.step) {
    case 'awaiting_amount':
      const amount = parseFloat(msg.text);
      const minWithdrawal = await Settings.getMinWithdrawal();
      const balance = await User.getBalance(state.userId);

      if (isNaN(amount) || amount < minWithdrawal || amount > balance) {
        const messages = {
          ar: `❌ مبلغ غير صالح. يجب أن يكون بين ${minWithdrawal} و ${balance.toFixed(2)} USDT`,
          en: `❌ Invalid amount. Must be between ${minWithdrawal} and ${balance.toFixed(2)} USDT`,
          ru: `❌ Неверная сумма. Должна быть от ${minWithdrawal} до ${balance.toFixed(2)} USDT`
        };
        await bot.sendMessage(chatId, messages[lang]);
        return true;
      }

      state.amount = amount;
      state.step = 'awaiting_method';
      
      const methodMessages = {
        ar: '💳 اختر طريقة السحب:',
        en: '💳 Choose withdrawal method:',
        ru: '💳 Выберите метод вывода:'
      };
      
      const keyboard = {
        inline_keyboard: [
          [{ text: 'Binance Pay ID', callback_data: 'withdraw_method_binance_id' }],
          [{ text: 'Wallet Address (USDT)', callback_data: 'withdraw_method_wallet' }]
        ]
      };
      
      await bot.sendMessage(chatId, methodMessages[lang], { reply_markup: keyboard });
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
        
        // خصم المبلغ من الرصيد بشكل ذري (Atomic)
        try {
          await User.updateBalance(state.userId, -state.amount);
        } catch (error) {
          if (error.message === 'INSUFFICIENT_BALANCE_OR_USER_NOT_FOUND') {
            const currentBalance = await User.getBalance(state.userId);
            logError('WITHDRAWAL', `Insufficient balance: ${currentBalance} < ${state.amount}`);
            const messages = {
              ar: `❌ رصيدك غير كافٍ\n\n👛 رصيدك: ${currentBalance.toFixed(2)} USDT\n💸 المبلغ المطلوب: ${state.amount} USDT`,
              en: `❌ Insufficient balance\n\n👛 Your balance: ${currentBalance.toFixed(2)} USDT\n💸 Requested amount: ${state.amount} USDT`,
              ru: `❌ Недостаточно средств\n\n👛 Ваш баланс: ${currentBalance.toFixed(2)} USDT\n💸 Запрошенная сумма: ${state.amount} USDT`
            };
            await bot.sendMessage(chatId, messages[lang]);
            withdrawalStates.delete(chatId);
            return true;
          }
          throw error;
        }
        
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

        const isAdmin = await Admin.isAdmin(msg.from.id);
        const successMessages = {
          ar: `✅ تم إرسال طلب السحب بنجاح!\n\n💰 المبلغ: ${state.amount} USDT\n🆔 رقم الطلب: ${withdrawalId}\n\n⏳ سيتم مراجعة طلبك قريباً\n\n📝 ملاحظة: تم خصم المبلغ من رصيدك`,
          en: `✅ Withdrawal request sent successfully!\n\n💰 Amount: ${state.amount} USDT\n🆔 Request ID: ${withdrawalId}\n\n⏳ Your request will be reviewed soon\n\n📝 Note: Amount has been deducted from your balance`,
          ru: `✅ Запрос на вывод успешно отправлен!\n\n💰 Сумма: ${state.amount} USDT\n🆔 ID запроса: ${withdrawalId}\n\n⏳ Ваш запрос скоро будет рассмотрен\n\n📝 Примечание: Сумма списана с вашего баланса`
        };
        
        await bot.sendMessage(chatId, successMessages[lang], isAdmin ? adminMenu : mainMenu);
        await notifyAdminsWithdrawal(bot, withdrawalId, state);
        withdrawalStates.delete(chatId);
      } catch (error) {
        logError('WITHDRAWAL', 'Failed to create withdrawal (Binance)', error);
        await bot.sendMessage(chatId, '❌ حدث خطأ أثناء إرسال الطلب');
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
        
        // خصم المبلغ من الرصيد بشكل ذري (Atomic)
        try {
          await User.updateBalance(state.userId, -state.amount);
        } catch (error) {
          if (error.message === 'INSUFFICIENT_BALANCE_OR_USER_NOT_FOUND') {
            const currentBalance = await User.getBalance(state.userId);
            logError('WITHDRAWAL', `Insufficient balance: ${currentBalance} < ${state.amount}`);
            const messages = {
              ar: `❌ رصيدك غير كافٍ\n\n👛 رصيدك: ${currentBalance.toFixed(2)} USDT\n💸 المبلغ المطلوب: ${state.amount} USDT`,
              en: `❌ Insufficient balance\n\n👛 Your balance: ${currentBalance.toFixed(2)} USDT\n💸 Requested amount: ${state.amount} USDT`,
              ru: `❌ Недостаточно средств\n\n👛 Ваш баланс: ${currentBalance.toFixed(2)} USDT\n💸 Запрошенная сумма: ${state.amount} USDT`
            };
            await bot.sendMessage(chatId, messages[lang]);
            withdrawalStates.delete(chatId);
            return true;
          }
          throw error;
        }
        
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

        const isAdmin = await Admin.isAdmin(msg.from.id);
        const successMessages = {
          ar: `✅ تم إرسال طلب السحب بنجاح!\n\n💰 المبلغ: ${state.amount} USDT\n📍 العنوان: ${state.walletAddress}\n🌐 الشبكة: ${state.network}\n🆔 رقم الطلب: ${withdrawalId}\n\n⏳ سيتم مراجعة طلبك قريباً\n\n📝 ملاحظة: تم خصم المبلغ من رصيدك`,
          en: `✅ Withdrawal request sent successfully!\n\n💰 Amount: ${state.amount} USDT\n📍 Address: ${state.walletAddress}\n🌐 Network: ${state.network}\n🆔 Request ID: ${withdrawalId}\n\n⏳ Your request will be reviewed soon\n\n📝 Note: Amount has been deducted from your balance`,
          ru: `✅ Запрос на вывод успешно отправлен!\n\n💰 Сумма: ${state.amount} USDT\n📍 Адрес: ${state.walletAddress}\n🌐 Сеть: ${state.network}\n🆔 ID запроса: ${withdrawalId}\n\n⏳ Ваш запрос скоро будет рассмотрен\n\n📝 Примечание: Сумма списана с вашего баланса`
        };
        
        await bot.sendMessage(chatId, successMessages[lang], isAdmin ? adminMenu : mainMenu);
        await notifyAdminsWithdrawal(bot, withdrawalId, state);
        withdrawalStates.set(chatId, state); // Keep state for further steps if needed, or delete if done
        withdrawalStates.delete(chatId);
      } catch (error) {
        logError('WITHDRAWAL', 'Failed to create withdrawal (Wallet)', error);
        await bot.sendMessage(chatId, '❌ حدث خطأ أثناء إرسال الطلب');
      }
      break;

    default:
      return false;
  }

  return true;
}

async function notifyAdminsWithdrawal(bot, withdrawalId, state) {
  const adminIds = await Admin.getAllAdminIds();
  const message = `🔔 طلب سحب جديد\n\n🆔 رقم الطلب: ${withdrawalId}\n💰 المبلغ: ${state.amount} USDT\n📍 الطريقة: ${state.method}`;
  
  for (const adminId of adminIds) {
    try {
      await bot.sendMessage(adminId, message);
    } catch (e) {
      logError('WITHDRAWAL_NOTIFY', `Failed to notify admin ${adminId}`);
    }
  }
}

export async function handleWithdrawalReview(bot, query) {
  const data = query.data;
  const reviewerId = query.from.id;
  
  if (data.startsWith('withdraw_accept_')) {
    const withdrawalId = parseInt(data.split('_')[2]);
    try {
      const withdrawal = await Withdrawal.getById(withdrawalId);
      if (withdrawal && withdrawal.status === 'pending') {
        await Withdrawal.updateStatus(withdrawalId, 'completed', reviewerId);
        await bot.answerCallbackQuery(query.id, { text: '✅ تم قبول السحب' });
        
        const user = await User.findById(withdrawal.user_id);
        const lang = user?.language || 'ar';
        const messages = {
          ar: `✅ تم تنفيذ طلب السحب الخاص بك!\n\n💰 المبلغ: ${withdrawal.amount} USDT\n🆔 رقم الطلب: ${withdrawalId}`,
          en: `✅ Your withdrawal request has been completed!\n\n💰 Amount: ${withdrawal.amount} USDT\n🆔 Request ID: ${withdrawalId}`,
          ru: `✅ Ваш запрос на вывод выполнен!\n\n💰 Сумма: ${withdrawal.amount} USDT\n🆔 ID запроса: ${withdrawalId}`
        };
        await bot.sendMessage(user.telegram_id, messages[lang]);
      }
    } catch (e) {
      logError('WITHDRAWAL_REVIEW', 'Error accepting withdrawal', e);
    }
  } else if (data.startsWith('withdraw_reject_')) {
    const withdrawalId = parseInt(data.split('_')[2]);
    withdrawalRejectStates.set(reviewerId, { withdrawalId });
    await bot.sendMessage(reviewerId, '❌ أرسل سبب الرفض:', cancelKeyboard);
    await bot.answerCallbackQuery(query.id);
  }
}

export async function handleWithdrawalRejectReason(bot, msg) {
  const reviewerId = msg.from.id;
  const state = withdrawalRejectStates.get(reviewerId);
  if (!state) return false;

  if (msg.text === '❌ إلغاء') {
    withdrawalRejectStates.delete(reviewerId);
    await bot.sendMessage(reviewerId, '❌ تم إلغاء العملية', adminMenu);
    return true;
  }

  const reason = msg.text;
  try {
    const withdrawal = await Withdrawal.getById(state.withdrawalId);
    if (withdrawal && withdrawal.status === 'pending') {
      await Withdrawal.updateStatus(state.withdrawalId, 'rejected', reviewerId, reason);
      // إرجاع المبلغ للمستخدم
      await User.updateBalance(withdrawal.user_id, withdrawal.amount);
      
      const user = await User.findById(withdrawal.user_id);
      const lang = user?.language || 'ar';
      const messages = {
        ar: `❌ تم رفض طلب السحب الخاص بك\n\n💰 المبلغ: ${withdrawal.amount} USDT\n📝 السبب: ${reason}\n\nتم إرجاع المبلغ لرصيدك`,
        en: `❌ Your withdrawal request was rejected\n\n💰 Amount: ${withdrawal.amount} USDT\n📝 Reason: ${reason}\n\nAmount has been refunded to your balance`,
        ru: `❌ Ваш запрос на вывод отклонен\n\n💰 Сумма: ${withdrawal.amount} USDT\n📝 Причина: ${reason}\n\nСумма возвращена на ваш баланس`
      };
      await bot.sendMessage(user.telegram_id, messages[lang]);
      await bot.sendMessage(reviewerId, '✅ تم رفض الطلب وإرجاع المبلغ للمستخدم', adminMenu);
    }
    withdrawalRejectStates.delete(reviewerId);
  } catch (e) {
    logError('WITHDRAWAL_REJECT', 'Error rejecting withdrawal', e);
  }
  return true;
}
