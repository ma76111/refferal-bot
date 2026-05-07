import Deposit from '../models/Deposit.js';
import User from '../models/User.js';
import Settings from '../models/Settings.js';
import config from '../config.js';
import logger from '../utils/logger.js';
import BinanceAPI from '../utils/binanceApi.js';
import { depositMethodKeyboard, cancelKeyboard, mainMenu, adminMenu, depositReviewKeyboard } from '../utils/keyboards.js';

const depositStates = new Map();
const MIN_DEPOSIT = 0.1;

export async function handleStartDeposit(bot, msg) {
  const chatId = msg.chat.id;
  const user = await User.findByTelegramId(msg.from.id);
  
  logger.user(`User ${msg.from.id} initiated deposit flow`);
  
  if (!user) {
    logger.warning(`User ${msg.from.id} not found`);
    return;
  }

  await bot.sendMessage(
    chatId,
    '💳 إيداع USDT\n\n' +
    '💰 الحد الأدنى للإيداع: 0.1 USDT\n\n' +
    'اختر طريقة الإيداع:',
    depositMethodKeyboard
  );
}

export async function handleDepositMethod(bot, query) {
  const chatId = query.message.chat.id;
  const user = await User.findByTelegramId(query.from.id);
  
  if (!user) {
    logger.warning(`User ${query.from.id} not found`);
    return;
  }

  // منع استخدام عنوان المحفظة (معطل مؤقتاً)
  if (query.data === 'deposit_wallet') {
    const lang = user.language || 'ar';
    const messages = {
      ar: '⚠️ الإيداع عبر عنوان المحفظة معطل مؤقتاً\n\nيرجى استخدام Binance Pay ID',
      en: '⚠️ Deposit via wallet address is temporarily disabled\n\nPlease use Binance Pay ID',
      ru: '⚠️ Пополнение через адрес кошелька временно отключено\n\nПожалуйста, используйте Binance Pay ID'
    };
    await bot.answerCallbackQuery(query.id, { text: messages[lang], show_alert: true });
    return;
  }

  const method = query.data === 'deposit_binance_id' ? 'binance_id' : 'wallet';
  const lang = user.language || 'ar';
  logger.callback(`Deposit method selected: ${method} by user ${query.from.id}`);

  depositStates.set(chatId, {
    userId: user.id,
    telegramId: query.from.id,
    method,
    step: 'awaiting_amount',
    lang
  });

  const messages = {
    ar: method === 'binance_id'
      ? '💳 الإيداع عبر Binance Pay ID\n\n💰 أرسل المبلغ بالـ USDT (الحد الأدنى: 0.1):'
      : '💳 الإيداع عبر عنوان المحفظة\n\n💰 أرسل المبلغ بالـ USDT (الحد الأدنى: 0.1):',
    en: method === 'binance_id'
      ? '💳 Deposit via Binance Pay ID\n\n💰 Send amount in USDT (minimum: 0.1):'
      : '💳 Deposit via Wallet Address\n\n💰 Send amount in USDT (minimum: 0.1):',
    ru: method === 'binance_id'
      ? '💳 Пополнение через Binance Pay ID\n\n💰 Отправьте сумму в USDT (минимум: 0.1):'
      : '💳 Пополнение через адрес кошелька\n\n💰 Отправьте сумму в USDT (минимум: 0.1):'
  };

  await bot.editMessageText(messages[lang], {
    chat_id: chatId,
    message_id: query.message.message_id
  });
}

export async function handleDepositSteps(bot, msg) {
  const chatId = msg.chat.id;
  const state = depositStates.get(chatId);
  
  if (!state) return false;

  if (msg.text === '❌ إلغاء') {
    depositStates.delete(chatId);
    const isAdmin = config.ADMIN_IDS.includes(msg.from.id);
    await bot.sendMessage(chatId, '❌ تم إلغاء العملية', isAdmin ? adminMenu : mainMenu);
    return true;
  }

  switch (state.step) {
    case 'awaiting_amount':
      const amount = parseFloat(msg.text);
      logger.info(`Deposit amount received: ${amount} USDT`);
      
      if (isNaN(amount) || amount < MIN_DEPOSIT) {
        logger.warning(`Invalid deposit amount: ${msg.text}`);
        await bot.sendMessage(chatId, `❌ المبلغ غير صحيح. الحد الأدنى: ${MIN_DEPOSIT} USDT`);
        return true;
      }
      
      state.amount = amount;
      logger.success(`Deposit amount accepted: ${amount} USDT`);
      
      if (state.method === 'binance_id') {
        // طريقة Binance Pay ID
        state.step = 'awaiting_binance_id';
        await bot.sendMessage(chatId, '🆔 أرسل Binance Pay ID الخاص بك:', cancelKeyboard);
      } else {
        // طريقة عنوان المحفظة
        try {
          const binance = new BinanceAPI(config.BINANCE_API_KEY, config.BINANCE_API_SECRET);
          const depositAddress = await binance.getDepositAddress('USDT', config.BINANCE_NETWORK);

          if (depositAddress) {
            state.step = 'awaiting_txid';
            await bot.sendMessage(
              chatId,
              `📍 عنوان المحفظة:\n\`${depositAddress.address}\`\n\n` +
              `🌐 الشبكة: ${config.BINANCE_NETWORK}\n` +
              `💰 المبلغ: ${amount} USDT\n\n` +
              '⚠️ تأكد من:\n' +
              '• استخدام الشبكة الصحيحة\n' +
              '• إرسال المبلغ المحدد\n\n' +
              '🔗 بعد التحويل، أرسل TXID:',
              { ...cancelKeyboard, parse_mode: 'Markdown' }
            );
          } else {
            await bot.sendMessage(chatId, '❌ حدث خطأ في الحصول على عنوان المحفظة');
            depositStates.delete(chatId);
          }
        } catch (error) {
          logger.error(`Failed to get deposit address: ${error.message}`);
          await bot.sendMessage(chatId, '❌ حدث خطأ، يرجى المحاولة لاحقاً');
          depositStates.delete(chatId);
        }
      }
      break;

    case 'awaiting_binance_id':
      state.binanceId = msg.text;
      state.step = 'awaiting_screenshot';
      await bot.sendMessage(chatId, '📸 أرسل صورة (سكرين) التحويل:', cancelKeyboard);
      break;

    case 'awaiting_screenshot':
      if (!msg.photo) {
        await bot.sendMessage(chatId, '❌ الرجاء إرسال صورة');
        return true;
      }

      const photo = msg.photo[msg.photo.length - 1];
      state.screenshotId = photo.file_id;

      try {
        logger.info(`Creating deposit request: ${state.amount} USDT via Binance Pay ID`);
        
        const depositId = await Deposit.create({
          userId: state.userId,
          amount: state.amount,
          method: state.method,
          binanceId: state.binanceId,
          txid: null,
          screenshotId: state.screenshotId,
          transferTime: new Date().toLocaleString('ar')
        });

        logger.success(`Deposit request created with ID: ${depositId}`);

        const isAdmin = config.ADMIN_IDS.includes(msg.from.id);
        await bot.sendMessage(
          chatId,
          '✅ تم إرسال طلب الإيداع بنجاح!\n\n' +
          `💰 المبلغ: ${state.amount} USDT\n` +
          `🆔 رقم الطلب: ${depositId}\n\n` +
          '⏳ سيتم مراجعة طلبك قريباً',
          isAdmin ? adminMenu : mainMenu
        );

        // إشعار المسؤولين
        await notifyAdminsDeposit(bot, depositId, state);

        depositStates.delete(chatId);
      } catch (error) {
        logger.error(`Failed to create deposit: ${error.message}`);
        await bot.sendMessage(chatId, '❌ حدث خطأ أثناء إرسال الطلب');
      }
      break;

    case 'awaiting_txid':
      state.txid = msg.text;

      try {
        await bot.sendMessage(chatId, '🔄 جاري التحقق من العملية...');

        // التحقق التلقائي من TXID
        const binance = new BinanceAPI(config.BINANCE_API_KEY, config.BINANCE_API_SECRET);
        const verificationResult = await binance.verifyDeposit(state.txid, 'USDT');

        if (verificationResult.verified) {
          // التحقق من المبلغ
          const amountMatch = Math.abs(verificationResult.amount - state.amount) <= 0.01;
          
          if (!amountMatch) {
            await bot.sendMessage(
              chatId,
              `⚠️ المبلغ غير مطابق!\n\n` +
              `المبلغ المطلوب: ${state.amount} USDT\n` +
              `المبلغ المستلم: ${verificationResult.amount} USDT\n\n` +
              'سيتم مراجعة الطلب يدوياً'
            );
          }

          // إنشاء سجل الإيداع
          const depositId = await Deposit.create({
            userId: state.userId,
            amount: verificationResult.amount,
            method: state.method,
            binanceId: null,
            txid: state.txid,
            screenshotId: null,
            transferTime: new Date(verificationResult.insertTime).toLocaleString('ar')
          });

          // قبول تلقائياً إذا كان المبلغ مطابق
          if (amountMatch) {
            await Deposit.updateStatus(depositId, 'accept', null, 'تم التحقق تلقائياً عبر Binance API');
            await User.updateBalance(state.userId, verificationResult.amount);

            const isAdmin = config.ADMIN_IDS.includes(msg.from.id);
            await bot.sendMessage(
              chatId,
              '✅ تم التحقق والقبول تلقائياً!\n\n' +
              `💰 المبلغ: ${verificationResult.amount} USDT\n` +
              `🆔 رقم العملية: ${depositId}\n\n` +
              'تم إضافة المبلغ إلى محفظتك',
              isAdmin ? adminMenu : mainMenu
            );

            logger.success(`Auto-verified deposit ${depositId}: ${verificationResult.amount} USDT`);

            // إشعار الأدمن
            for (const adminId of config.ADMIN_IDS) {
              try {
                await bot.sendMessage(
                  adminId,
                  `🔔 إيداع تلقائي جديد\n\n` +
                  `👤 المستخدم: ${state.telegramId}\n` +
                  `💰 المبلغ: ${verificationResult.amount} USDT\n` +
                  `🔗 TXID: ${state.txid}\n` +
                  `✅ تم القبول تلقائياً`
                );
              } catch (error) {
                logger.error(`Failed to notify admin ${adminId}`);
              }
            }
          } else {
            // إرسال للمراجعة اليدوية
            const isAdmin = config.ADMIN_IDS.includes(msg.from.id);
            await bot.sendMessage(
              chatId,
              '✅ تم التحقق من العملية!\n\n' +
              `💰 المبلغ: ${verificationResult.amount} USDT\n` +
              `🆔 رقم الطلب: ${depositId}\n\n` +
              '⏳ سيتم مراجعة الطلب بسبب اختلاف المبلغ',
              isAdmin ? adminMenu : mainMenu
            );

            // إشعار الأدمن للمراجعة
            await notifyAdminsDeposit(bot, depositId, {
              ...state,
              amount: verificationResult.amount,
              screenshotId: null
            });
          }
        } else {
          await bot.sendMessage(
            chatId,
            '❌ لم يتم العثور على العملية\n\n' +
            'تأكد من:\n' +
            '• صحة TXID\n' +
            '• اكتمال التحويل\n' +
            '• استخدام الشبكة الصحيحة\n\n' +
            'يمكنك المحاولة مرة أخرى'
          );
        }

        depositStates.delete(chatId);
      } catch (error) {
        logger.error(`Failed to verify deposit: ${error.message}`);
        await bot.sendMessage(chatId, '❌ حدث خطأ أثناء التحقق');
        depositStates.delete(chatId);
      }
      break;

    default:
      return false;
  }

  depositStates.set(chatId, state);
  return true;
}

async function notifyAdminsDeposit(bot, depositId, state) {
  logger.info(`Notifying admins about deposit ${depositId}`);
  
  let message = '🔔 طلب إيداع جديد\n\n';
  message += `🆔 رقم الطلب: ${depositId}\n`;
  message += `💰 المبلغ: ${state.amount} USDT\n`;
  message += `📍 الطريقة: ${state.method === 'binance_id' ? 'Binance Pay ID' : 'عنوان المحفظة'}\n\n`;
  
  if (state.method === 'binance_id') {
    message += `🆔 Binance Pay ID: ${state.binanceId}\n`;
  } else {
    message += `🔗 TXID: ${state.txid}\n`;
  }

  for (const adminId of config.ADMIN_IDS) {
    try {
      await bot.sendMessage(adminId, message, depositReviewKeyboard(depositId));
      
      if (state.screenshotId) {
        await bot.sendPhoto(adminId, state.screenshotId, {
          caption: '📸 صورة التحويل'
        });
      }
      logger.success(`Admin ${adminId} notified about deposit ${depositId}`);
    } catch (error) {
      logger.error(`Failed to notify admin ${adminId}: ${error.message}`);
    }
  }
}

export async function handleDepositReview(bot, query) {
  const data = query.data;
  const reviewerId = query.from.id;

  logger.callback(`Deposit review action: ${data} by admin ${reviewerId}`);

  if (!config.ADMIN_IDS.includes(reviewerId)) {
    logger.warning(`Unauthorized deposit review attempt by ${reviewerId}`);
    await bot.answerCallbackQuery(query.id, { text: '❌ غير مصرح لك' });
    return;
  }

  if (data.startsWith('deposit_accept_')) {
    const depositId = parseInt(data.split('_')[2]);
    logger.info(`Processing deposit acceptance: ${depositId}`);
    
    const deposit = await Deposit.getById(depositId);
    
    if (!deposit) {
      logger.warning(`Deposit ${depositId} not found`);
      await bot.answerCallbackQuery(query.id, { text: '❌ الطلب غير موجود' });
      return;
    }

    if (deposit.status !== 'pending') {
      logger.warning(`Deposit ${depositId} already reviewed (status: ${deposit.status})`);
      await bot.answerCallbackQuery(query.id, { text: '⚠️ تمت المراجعة مسبقاً' });
      return;
    }

    const user = await User.findByTelegramId(reviewerId);
    await Deposit.updateStatus(depositId, 'accept', user.id);
    await User.updateBalance(deposit.user_id, deposit.amount);

    logger.success(`Deposit ${depositId} accepted, ${deposit.amount} USDT added to user ${deposit.user_id}`);

    await bot.sendMessage(
      deposit.user_telegram_id,
      `✅ تم قبول طلب الإيداع!\n\n` +
      `🆔 رقم الطلب: ${depositId}\n` +
      `💰 المبلغ المضاف: ${deposit.amount} USDT\n\n` +
      `تم إضافة المبلغ إلى محفظتك بنجاح`
    );

    await bot.editMessageText(
      query.message.text + '\n\n✅ تم القبول',
      { chat_id: query.message.chat.id, message_id: query.message.message_id }
    );

    await bot.answerCallbackQuery(query.id, { text: '✅ تمت الموافقة' });
  } else if (data.startsWith('deposit_reject_')) {
    const depositId = parseInt(data.split('_')[2]);
    logger.info(`Initiating deposit rejection flow for: ${depositId}`);
    
    depositRejectStates.set(query.message.chat.id, { depositId });
    
    await bot.sendMessage(
      query.message.chat.id,
      '❌ رفض طلب الإيداع\n\n📝 أرسل سبب الرفض:',
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

const depositRejectStates = new Map();

export async function handleDepositRejectReason(bot, msg) {
  const chatId = msg.chat.id;
  const state = depositRejectStates.get(chatId);
  
  if (!state) return false;

  if (msg.text === '❌ إلغاء') {
    logger.info(`Deposit rejection cancelled by admin ${msg.from.id}`);
    depositRejectStates.delete(chatId);
    await bot.sendMessage(chatId, '❌ تم إلغاء العملية', adminMenu);
    return true;
  }

  const reason = msg.text;
  logger.info(`Deposit ${state.depositId} rejection reason: ${reason}`);
  
  const deposit = await Deposit.getById(state.depositId);
  
  if (!deposit) {
    logger.warning(`Deposit ${state.depositId} not found`);
    await bot.sendMessage(chatId, '❌ الطلب غير موجود');
    depositRejectStates.delete(chatId);
    return true;
  }

  const user = await User.findByTelegramId(msg.from.id);
  await Deposit.updateStatus(state.depositId, 'reject', user.id, reason);

  logger.success(`Deposit ${state.depositId} rejected by admin ${msg.from.id}`);

  const supportText = await Settings.getSupportText('ar');
  
  await bot.sendMessage(
    deposit.user_telegram_id,
    `❌ تم رفض طلب الإيداع\n\n` +
    `🆔 رقم الطلب: ${state.depositId}\n` +
    `💰 المبلغ: ${deposit.amount} USDT\n\n` +
    `📝 السبب: ${reason}\n\n` +
    `إذا كنت تعتقد أن هناك مشكلة، يرجى التواصل مع الدعم:\n${supportText}`
  );

  await bot.sendMessage(chatId, '✅ تم رفض الطلب وإرسال الإشعار للمستخدم', adminMenu);
  
  depositRejectStates.delete(chatId);
  return true;
}

export { depositStates, depositRejectStates };
