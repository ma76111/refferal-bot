import Task from '../models/Task.js';
import User from '../models/User.js';
import Submission from '../models/Submission.js';
import Settings from '../models/Settings.js';
import config from '../config.js';
import logger from '../utils/logger.js';
import { getTaskTypeKeyboard, getProofTypeKeyboard, cancelKeyboard, mainMenu, adminMenu, getMainMenuKeyboard } from '../utils/keyboards.js';
import Admin from '../models/Admin.js';

const userStates = new Map();

export async function handleAddTask(bot, msg) {
  const chatId = msg.chat.id;
  const user = await User.findByTelegramId(msg.from.id);
  
  logger.user(`User ${msg.from.id} initiated add task flow`);
  
  if (!user) {
    logger.warning(`User ${msg.from.id} not found in database`);
    return;
  }

  const lang = user.language || 'ar';

  // التحقق من عدد المهام النشطة للمستخدم
  const activeTasksCount = await Task.getUserActiveTasksCount(user.id);
  const maxTasksPerUser = await Settings.getMaxTasksPerUser();

  logger.info(`User ${user.id} has ${activeTasksCount}/${maxTasksPerUser} active tasks`);

  if (activeTasksCount >= maxTasksPerUser) {
    logger.warning(`User ${user.id} reached max tasks limit`);
    
    const messages = {
      ar: `❌ لقد وصلت للحد الأقصى من المهام النشطة\n\n📊 المهام النشطة: ${activeTasksCount}/${maxTasksPerUser}\n\n💡 يمكنك إضافة مهام جديدة بعد اكتمال المهام الحالية`,
      en: `❌ You have reached the maximum number of active tasks\n\n📊 Active tasks: ${activeTasksCount}/${maxTasksPerUser}\n\n💡 You can add new tasks after completing current ones`,
      ru: `❌ Вы достигли максимального количества активных задач\n\n📊 Активные задачи: ${activeTasksCount}/${maxTasksPerUser}\n\n💡 Вы можете добавить новые задачи после завершения текущих`
    };
    
    await bot.sendMessage(chatId, messages[lang]);
    return;
  }

  const selectTaskTypeMessages = {
    ar: '🤖 اختر نوع المهمة:',
    en: '🤖 Select task type:',
    ru: '🤖 Выберите тип задачи:'
  };

  await bot.sendMessage(chatId, selectTaskTypeMessages[lang], getTaskTypeKeyboard(lang));
  userStates.set(chatId, { step: 'awaiting_task_type', userId: user.id, lang });
  logger.info(`Task creation flow started for user ${user.id}`);
}

export async function handleTaskType(bot, query) {
  const chatId = query.message.chat.id;
  const taskType = query.data === 'task_type_paid' ? 'paid' : 'exchange';
  
  logger.callback(`Task type selected: ${taskType} by user ${query.from.id}`);
  
  const state = userStates.get(chatId) || {};
  const lang = state.lang || 'ar';
  state.taskType = taskType;
  state.step = 'awaiting_bot_name';
  userStates.set(chatId, state);

  const taskTypeTexts = {
    ar: {
      paid: 'مهمة مدفوعة',
      exchange: 'تبادل إحالات',
      selected: 'تم اختيار',
      sendBotName: 'أرسل اسم البوت'
    },
    en: {
      paid: 'Paid Task',
      exchange: 'Referral Exchange',
      selected: 'Selected',
      sendBotName: 'Send bot name'
    },
    ru: {
      paid: 'Платная задача',
      exchange: 'Обмен рефералами',
      selected: 'Выбрано',
      sendBotName: 'Отправьте имя бота'
    }
  };

  const t = taskTypeTexts[lang];
  const selectedType = taskType === 'paid' ? t.paid : t.exchange;
  const message = `✅ ${t.selected}: ${selectedType}\n\n📝 ${t.sendBotName}:`;

  try {
    await bot.editMessageText(message, { 
      chat_id: chatId, 
      message_id: query.message.message_id,
      reply_markup: { inline_keyboard: [] }
    });
  } catch (error) {
    // معالجة أخطاء Telegram API
    if (error.response && error.response.body) {
      const errorDesc = error.response.body.description || '';
      
      // إذا كانت الرسالة محذوفة أو نفس المحتوى، نرسل رسالة جديدة
      if (errorDesc.includes('message to edit not found') || 
          errorDesc.includes('message is not modified')) {
        logger.warning(`Cannot edit message, sending new one: ${errorDesc}`);
        await bot.sendMessage(chatId, message, cancelKeyboard);
      } else {
        // خطأ آخر، نسجله ونرسل رسالة جديدة
        logger.error(`Error editing message: ${errorDesc}`);
        await bot.sendMessage(chatId, message, cancelKeyboard);
      }
    } else {
      // خطأ غير متوقع
      logger.error(`Unexpected error in handleTaskType: ${error.message}`);
      await bot.sendMessage(chatId, message, cancelKeyboard);
    }
  }
  
  await bot.answerCallbackQuery(query.id);
}

export async function handleTaskCreationSteps(bot, msg) {
  const chatId = msg.chat.id;
  const state = userStates.get(chatId);
  
  if (!state) return false;

  const lang = state.lang || 'ar';

  if (msg.text === '❌ إلغاء') {
    userStates.delete(chatId);
    const cancelMessages = {
      ar: '❌ تم إلغاء العملية',
      en: '❌ Operation cancelled',
      ru: '❌ Операция отменена'
    };
    await bot.sendMessage(chatId, cancelMessages[lang], mainMenu);
    return true;
  }

  // تجاهل أزرار القائمة الرئيسية عندما يكون في حالة انتظار
  const menuButtons = [
    '📋 مهامي', '➕ إضافة مهمة', '💰 محفظتي', '💵 إيداع', '💸 سحب',
    'ℹ️ معلوماتي', '📞 الدعم', '🌐 تغيير اللغة', '⚙️ لوحة التحكم',
    '📖 طريقة العمل'
  ];
  
  if (menuButtons.includes(msg.text)) {
    // إلغاء الحالة الحالية والسماح بمعالجة الزر الجديد
    userStates.delete(chatId);
    return false; // السماح لمعالجات الأزرار الأخرى بالعمل
  }

  switch (state.step) {
    case 'awaiting_bot_name':
      logger.info(`Bot name received: ${msg.text}`);
      // التحقق من أن الاسم ليس رابطاً
      if (msg.text.includes('http://') || msg.text.includes('https://') || msg.text.includes('t.me/') || msg.text.includes('telegram.me/')) {
        logger.warning(`Invalid bot name (contains URL): ${msg.text}`);
        const messages = {
          ar: '❌ اسم البوت يجب أن يكون نصاً وليس رابطاً\n\nمثال صحيح: Egypt Easy Cash Bot\n❌ خطأ: https://t.me/bot',
          en: '❌ Bot name must be text, not a link\n\nCorrect example: Egypt Easy Cash Bot\n❌ Wrong: https://t.me/bot',
          ru: '❌ Имя бота должно быть текстом, а не ссылкой\n\nПравильный пример: Egypt Easy Cash Bot\n❌ Неправильно: https://t.me/bot'
        };
        await bot.sendMessage(chatId, messages[lang]);
        return true;
      }
      // التحقق من أن الاسم ليس رقماً بالكامل
      if (/^\d+$/.test(msg.text.trim())) {
        logger.warning(`Invalid bot name (numbers only): ${msg.text}`);
        const messages = {
          ar: '❌ اسم البوت لا يمكن أن يكون رقماً فقط\n\nيمكن أن يحتوي على أرقام لكن ليس رقماً بالكامل',
          en: '❌ Bot name cannot be only numbers\n\nIt can contain numbers but not be entirely numeric',
          ru: '❌ Имя бота не может быть только цифрами\n\nОно может содержать цифры, но не быть полностью числовым'
        };
        await bot.sendMessage(chatId, messages[lang]);
        return true;
      }
      state.botName = msg.text;
      state.step = 'awaiting_referral_link';
      const linkMessages = {
        ar: '🔗 أرسل رابط الإحالة:',
        en: '🔗 Send referral link:',
        ru: '🔗 Отправьте реферальную ссылку:'
      };
      await bot.sendMessage(chatId, linkMessages[lang], cancelKeyboard);
      logger.success(`Bot name accepted: ${msg.text}`);
      break;

    case 'awaiting_referral_link':
      logger.info(`Referral link received: ${msg.text}`);
      if (!msg.text.startsWith('http')) {
        logger.warning(`Invalid link format: ${msg.text}`);
        const messages = {
          ar: '❌ الرجاء إرسال رابط صحيح',
          en: '❌ Please send a valid link',
          ru: '❌ Пожалуйста, отправьте действительную ссылку'
        };
        await bot.sendMessage(chatId, messages[lang]);
        return true;
      }
      // التحقق من أن الرابط لتيليجرام فقط
      if (!msg.text.includes('t.me/') && !msg.text.includes('telegram.me/')) {
        logger.warning(`Non-Telegram link rejected: ${msg.text}`);
        const messages = {
          ar: '❌ يجب أن يكون الرابط لتيليجرام فقط\n\nمثال: https://t.me/botname?start=myref',
          en: '❌ Link must be for Telegram only\n\nExample: https://t.me/botname?start=myref',
          ru: '❌ Ссылка должна быть только для Telegram\n\nПример: https://t.me/botname?start=myref'
        };
        await bot.sendMessage(chatId, messages[lang]);
        return true;
      }
      // استخراج اسم البوت من الرابط والتحقق منه
      const urlMatch = msg.text.match(/(?:t\.me|telegram\.me)\/([^?\/]+)/);
      if (urlMatch && urlMatch[1]) {
        const botUsername = urlMatch[1];
        // التحقق من أن اسم البوت ليس رقماً بالكامل
        if (/^\d+$/.test(botUsername)) {
          logger.warning(`Bot username is numbers only: ${botUsername}`);
          const messages = {
            ar: '❌ اسم البوت في الرابط لا يمكن أن يكون رقماً فقط\n\nمثال صحيح: https://t.me/my_bot?start=ref\n❌ خطأ: https://t.me/123456?start=ref',
            en: '❌ Bot username in link cannot be only numbers\n\nCorrect: https://t.me/my_bot?start=ref\n❌ Wrong: https://t.me/123456?start=ref',
            ru: '❌ Имя бота в ссылке не может быть только цифрами\n\nПравильно: https://t.me/my_bot?start=ref\n❌ Неправильно: https://t.me/123456?start=ref'
          };
          await bot.sendMessage(chatId, messages[lang]);
          return true;
        }
      }
      // ملاحظة: معامل start يمكن أن يكون أي شيء (نص، أرقام، أو مزيج)
      // العديد من البوتات تستخدم معرفات المستخدمين (أرقام) كمعامل إحالة
      // لذلك لا نقوم بفحص محتوى معامل start
      state.referralLink = msg.text;
      state.step = 'awaiting_required_count';
      const maxCount = await Settings.getMaxRequiredCount();
      logger.success(`Referral link accepted: ${msg.text}`);
      const countMessages = {
        ar: `🔢 كم عدد الأشخاص المطلوبين؟\n\n⚠️ الحد الأقصى حالياً: ${maxCount} أشخاص\n💡 سيزداد الحد مع زيادة عدد مستخدمي البوت`,
        en: `🔢 How many people are required?\n\n⚠️ Current maximum: ${maxCount} people\n💡 The limit will increase as the bot grows`,
        ru: `🔢 Сколько человек требуется?\n\n⚠️ Текущий максимум: ${maxCount} человек\n💡 Лимит увеличится по мере роста бота`
      };
      await bot.sendMessage(chatId, countMessages[lang], cancelKeyboard);
      break;

    case 'awaiting_required_count':
      const count = parseInt(msg.text);
      if (isNaN(count) || count <= 0) {
        const messages = {
          ar: '❌ الرجاء إرسال رقم صحيح',
          en: '❌ Please send a valid number',
          ru: '❌ Пожалуйста, отправьте действительное число'
        };
        await bot.sendMessage(chatId, messages[lang]);
        return true;
      }
      const maxCountCheck = await Settings.getMaxRequiredCount();
      if (count > maxCountCheck) {
        const messages = {
          ar: `❌ الحد الأقصى حالياً هو ${maxCountCheck} أشخاص\n\n💡 سيزداد الحد الأقصى تلقائياً مع زيادة عدد مستخدمي البوت`,
          en: `❌ Current maximum is ${maxCountCheck} people\n\n💡 The limit will increase automatically as the bot grows`,
          ru: `❌ Текущий максимум ${maxCountCheck} человек\n\n💡 Лимит увеличится автоматически по мере роста бота`
        };
        await bot.sendMessage(chatId, messages[lang]);
        return true;
      }
      
      // فحص النقاط لمهام التبادل
      if (state.taskType === 'exchange') {
        const user = await User.findById(state.userId);
        if (!user) {
          logger.error(`User ${state.userId} not found`);
          const messages = {
            ar: '❌ حدث خطأ، الرجاء المحاولة مرة أخرى',
            en: '❌ An error occurred, please try again',
            ru: '❌ Произошла ошибка, попробуйте еще раз'
          };
          await bot.sendMessage(chatId, messages[lang]);
          return true;
        }
        
        const exchangePoints = await User.getExchangePoints(user.id);
        
        if (exchangePoints < count) {
          logger.warning(`User ${state.userId} has insufficient exchange points: ${exchangePoints} < ${count}`);
          const messages = {
            ar: `❌ نقاط التبادل لديك غير كافية لإنشاء هذه المهمة\n\n🔄 نقاطك الحالية: ${exchangePoints}\n📊 النقاط المطلوبة: ${count}\n💡 المطلوب: ${count - exchangePoints} نقطة إضافية\n\n✅ لزيادة نقاطك:\n• نفذ مهام الآخرين لتحصل على نقاط (+1 لكل مهمة)\n• كل مهمة تنفذها = +1 نقطة تبادل`,
            en: `❌ Your exchange points are insufficient to create this task\n\n🔄 Your current points: ${exchangePoints}\n📊 Required points: ${count}\n💡 Needed: ${count - exchangePoints} more points\n\n✅ To increase your points:\n• Complete others' tasks to get points (+1 per task)\n• Each task you complete = +1 exchange point`,
            ru: `❌ Ваших баллов обмена недостаточно для создания этой задачи\n\n🔄 Ваши текущие баллы: ${exchangePoints}\n📊 Требуемые баллы: ${count}\n💡 Необходимо: ${count - exchangePoints} дополнительных баллов\n\n✅ Чтобы увеличить баллы:\n• Выполняйте задачи других, чтобы получить баллы (+1 за задачу)\n• Каждая выполненная задача = +1 балл обмена`
          };
          await bot.sendMessage(chatId, messages[lang]);
          return true;
        }
        
        logger.success(`User ${state.userId} has sufficient exchange points: ${exchangePoints} >= ${count}`);
      }
      
      state.requiredCount = count;
      
      if (state.taskType === 'paid') {
        state.step = 'awaiting_reward';
        const rewardMessages = {
          ar: '💰 كم المكافأة لكل شخص؟',
          en: '💰 What is the reward per person?',
          ru: '💰 Какая награда за человека?'
        };
        await bot.sendMessage(chatId, rewardMessages[lang], cancelKeyboard);
      } else {
        state.rewardPerUser = 0;
        state.step = 'awaiting_verification_instructions';
        const instructionsMessages = {
          ar: '📋 أرسل تعليمات التحقق:',
          en: '📋 Send verification instructions:',
          ru: '📋 Отправьте инструкции по проверке:'
        };
        await bot.sendMessage(chatId, instructionsMessages[lang], cancelKeyboard);
      }
      break;

    case 'awaiting_reward':
      const reward = parseFloat(msg.text);
      if (isNaN(reward) || reward <= 0) {
        const messages = {
          ar: '❌ الرجاء إرسال مبلغ صحيح',
          en: '❌ Please send a valid amount',
          ru: '❌ Пожалуйста, отправьте действительную сумму'
        };
        await bot.sendMessage(chatId, messages[lang]);
        return true;
      }
      
      // التحقق من الحد الأدنى للمكافأة
      const minReward = await Settings.getMinReward();
      if (reward < minReward) {
        const messages = {
          ar: `❌ الحد الأدنى للمكافأة هو ${minReward} USDT\n\n💡 يمكن للأدمن تغيير هذا الحد من لوحة التحكم`,
          en: `❌ Minimum reward is ${minReward} USDT\n\n💡 Admin can change this limit from control panel`,
          ru: `❌ Минимальная награда ${minReward} USDT\n\n💡 Администратор может изменить этот лимит из панели управления`
        };
        await bot.sendMessage(chatId, messages[lang]);
        return true;
      }
      
      // حساب التكلفة الإجمالية للمهمة
      const totalCost = reward * state.requiredCount;
      
      // الحصول على رصيد المستخدم الحالي
      const user = await User.findById(state.userId);
      if (!user) {
        logger.error(`User ${state.userId} not found`);
        const messages = {
          ar: '❌ حدث خطأ، الرجاء المحاولة مرة أخرى',
          en: '❌ An error occurred, please try again',
          ru: '❌ Произошла ошибка, попробуйте еще раз'
        };
        await bot.sendMessage(chatId, messages[lang]);
        return true;
      }
      
      // التحقق من أن المستخدم يملك رصيد كافي
      if (user.balance < totalCost) {
        logger.warning(`User ${state.userId} has insufficient balance: ${user.balance} < ${totalCost}`);
        const messages = {
          ar: `❌ رصيدك غير كافٍ لإنشاء هذه المهمة\n\n💰 رصيدك الحالي: ${user.balance.toFixed(2)} USDT\n📊 التكلفة المطلوبة: ${totalCost.toFixed(2)} USDT\n💡 المطلوب: ${(totalCost - user.balance).toFixed(2)} USDT إضافية\n\n🔄 يمكنك إيداع المزيد من الأموال أو تقليل عدد الأشخاص/المكافأة`,
          en: `❌ Your balance is insufficient to create this task\n\n💰 Your current balance: ${user.balance.toFixed(2)} USDT\n📊 Required cost: ${totalCost.toFixed(2)} USDT\n💡 Needed: ${(totalCost - user.balance).toFixed(2)} USDT more\n\n🔄 You can deposit more funds or reduce the number of people/reward`,
          ru: `❌ Ваш баланс недостаточен для создания этой задачи\n\n💰 Ваш текущий баланс: ${user.balance.toFixed(2)} USDT\n📊 Требуемая стоимость: ${totalCost.toFixed(2)} USDT\n💡 Необходимо: ${(totalCost - user.balance).toFixed(2)} USDT дополнительно\n\n🔄 Вы можете внести больше средств или уменьшить количество людей/награду`
        };
        await bot.sendMessage(chatId, messages[lang]);
        return true;
      }
      
      logger.success(`User ${state.userId} has sufficient balance: ${user.balance} >= ${totalCost}`);
      
      state.rewardPerUser = reward;
      state.totalCost = totalCost;
      state.step = 'awaiting_verification_instructions';
      const instructionsMessages = {
        ar: '📋 أرسل تعليمات التحقق:',
        en: '📋 Send verification instructions:',
        ru: '📋 Отправьте инструкции по проверке:'
      };
      await bot.sendMessage(chatId, instructionsMessages[lang], cancelKeyboard);
      break;

    case 'awaiting_verification_instructions':
      state.verificationInstructions = msg.text;
      state.step = 'awaiting_proof_type';
      
      const proofTypeMessages = {
        ar: '📸 اختر نوع الإثبات المطلوب:',
        en: '📸 Select required proof type:',
        ru: '📸 Выберите требуемый тип доказательства:'
      };
      
      await bot.sendMessage(chatId, proofTypeMessages[lang], getProofTypeKeyboard(lang));
      break;

    default:
      return false;
  }

  userStates.set(chatId, state);
  return true;
}

export async function handleProofType(bot, query) {
  const chatId = query.message.chat.id;
  const state = userStates.get(chatId);
  
  if (!state) return;

  const lang = state.lang || 'ar';

  const proofTypeMap = {
    'proof_text': 'text',
    'proof_images': 'images',
    'proof_both': 'both'
  };

  state.proofType = proofTypeMap[query.data];
  state.step = 'awaiting_confirmation';
  userStates.set(chatId, state);

  // عرض ملخص المهمة للتأكيد
  const proofTypeTexts = {
    ar: {
      text: 'نص فقط',
      images: 'صور فقط',
      both: 'نص + صور'
    },
    en: {
      text: 'Text only',
      images: 'Images only',
      both: 'Text + images'
    },
    ru: {
      text: 'Только текст',
      images: 'Только изображения',
      both: 'Текст + изображения'
    }
  };

  const confirmMessages = {
    ar: {
      title: '📋 تأكيد إنشاء المهمة',
      bot: 'البوت',
      link: 'رابط الإحالة',
      required: 'العدد المطلوب',
      type: 'نوع المهمة',
      paid: 'مهمة مدفوعة',
      exchange: 'تبادل إحالات',
      reward: 'المكافأة لكل شخص',
      exchangePoint: '+1 نقطة تبادل',
      totalCost: 'التكلفة الإجمالية',
      yourBalance: 'رصيدك الحالي',
      remaining: 'الرصيد المتبقي',
      instructions: 'التعليمات',
      proofType: 'نوع الإثبات',
      question: '\n❓ هل تريد إنشاء هذه المهمة؟',
      confirm: '✅ تأكيد الإنشاء',
      cancel: '❌ إلغاء'
    },
    en: {
      title: '📋 Confirm Task Creation',
      bot: 'Bot',
      link: 'Referral link',
      required: 'Required count',
      type: 'Task type',
      paid: 'Paid task',
      exchange: 'Referral exchange',
      reward: 'Reward per person',
      exchangePoint: '+1 Exchange Point',
      totalCost: 'Total cost',
      yourBalance: 'Your current balance',
      remaining: 'Remaining balance',
      instructions: 'Instructions',
      proofType: 'Proof type',
      question: '\n❓ Do you want to create this task?',
      confirm: '✅ Confirm Creation',
      cancel: '❌ Cancel'
    },
    ru: {
      title: '📋 Подтверждение создания задачи',
      bot: 'Бот',
      link: 'Реферальная ссылка',
      required: 'Требуется',
      type: 'Тип задачи',
      paid: 'Платная задача',
      exchange: 'Обмен рефералами',
      reward: 'Награда за человека',
      exchangePoint: '+1 Балл обмена',
      totalCost: 'Общая стоимость',
      yourBalance: 'Ваш текущий баланс',
      remaining: 'Остаток баланса',
      instructions: 'Инструкции',
      proofType: 'Тип доказательства',
      question: '\n❓ Вы хотите создать эту задачу?',
      confirm: '✅ Подтвердить создание',
      cancel: '❌ Отмена'
    }
  };

  const t = confirmMessages[lang];
  const taskTypeText = state.taskType === 'paid' ? t.paid : t.exchange;
  const rewardText = state.taskType === 'paid' ? `${state.rewardPerUser} USDT` : t.exchangePoint;
  const proofText = proofTypeTexts[lang][state.proofType];

  let message = `${t.title}\n\n`;
  message += `🤖 ${t.bot}: ${state.botName}\n`;
  message += `🔗 ${t.link}:\n${state.referralLink}\n\n`;
  message += `👥 ${t.required}: ${state.requiredCount}\n`;
  message += `📊 ${t.type}: ${taskTypeText}\n`;
  message += `💰 ${t.reward}: ${rewardText}\n`;
  
  // إضافة معلومات التكلفة والرصيد للمهام المدفوعة
  if (state.taskType === 'paid') {
    const totalCost = state.rewardPerUser * state.requiredCount;
    const user = await User.findById(state.userId);
    if (user) {
      const remainingBalance = user.balance - totalCost;
      message += `💸 ${t.totalCost}: ${totalCost.toFixed(2)} USDT\n`;
      message += `💰 ${t.yourBalance}: ${user.balance.toFixed(2)} USDT\n`;
      message += `📊 ${t.remaining}: ${remainingBalance.toFixed(2)} USDT\n`;
    }
  }
  
  message += `📸 ${t.proofType}: ${proofText}\n\n`;
  message += `📝 ${t.instructions}:\n${state.verificationInstructions}`;
  message += t.question;

  try {
    await bot.editMessageText(message, {
      chat_id: chatId,
      message_id: query.message.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: t.confirm, callback_data: 'confirm_create_task' }],
          [{ text: t.cancel, callback_data: 'cancel_create_task' }]
        ]
      }
    });
  } catch (error) {
    // معالجة أخطاء Telegram API
    if (error.response && error.response.body) {
      const errorDesc = error.response.body.description || '';
      
      // إذا كانت الرسالة محذوفة أو نفس المحتوى، نرسل رسالة جديدة
      if (errorDesc.includes('message to edit not found') || 
          errorDesc.includes('message is not modified')) {
        logger.warning(`Cannot edit message, sending new one: ${errorDesc}`);
        await bot.sendMessage(chatId, message, {
          reply_markup: {
            inline_keyboard: [
              [{ text: t.confirm, callback_data: 'confirm_create_task' }],
              [{ text: t.cancel, callback_data: 'cancel_create_task' }]
            ]
          }
        });
      } else {
        // خطأ آخر، نسجله ونرسل رسالة جديدة
        logger.error(`Error editing message: ${errorDesc}`);
        await bot.sendMessage(chatId, message, {
          reply_markup: {
            inline_keyboard: [
              [{ text: t.confirm, callback_data: 'confirm_create_task' }],
              [{ text: t.cancel, callback_data: 'cancel_create_task' }]
            ]
          }
        });
      }
    } else {
      // خطأ غير متوقع
      logger.error(`Unexpected error in handleProofType: ${error.message}`);
      await bot.sendMessage(chatId, message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: t.confirm, callback_data: 'confirm_create_task' }],
            [{ text: t.cancel, callback_data: 'cancel_create_task' }]
          ]
        }
      });
    }
  }
  
  await bot.answerCallbackQuery(query.id);
}

export async function handleViewTasks(bot, msg) {
  const chatId = msg.chat.id;
  const user = await User.findByTelegramId(msg.from.id);
  
  logger.user(`User ${msg.from.id} viewing tasks`);
  
  if (!user) {
    logger.warning(`User ${msg.from.id} not found`);
    return;
  }

  const lang = user.language || 'ar';
  const tasks = await Task.getActiveTasks(user.id);
  logger.info(`Found ${tasks.length} active tasks for user ${user.id}`);

  if (tasks.length === 0) {
    const messages = {
      ar: '❌ لا توجد مهام متاحة حالياً',
      en: '❌ No tasks available currently',
      ru: '❌ В настоящее время нет доступных задач'
    };
    await bot.sendMessage(chatId, messages[lang]);
    return;
  }

  const headers = {
    ar: '📋 المهام المتاحة (مرتبة حسب أعلى مكافأة):',
    en: '📋 Available Tasks (sorted by highest reward):',
    ru: '📋 Доступные задачи (отсортированы по наибольшей награде):'
  };

  const yourTaskText = {
    ar: '(مهمتك)',
    en: '(your task)',
    ru: '(ваша задача)'
  };

  const exchangeText = {
    ar: '+1 نقطة تبادل',
    en: '+1 Exchange Point',
    ru: '+1 Балл обмена'
  };

  const executeText = {
    ar: '✅ تنفيذ المهمة',
    en: '✅ Execute Task',
    ru: '✅ Выполнить задачу'
  };

  const hideText = {
    ar: '❌ إخفاء المهمة',
    en: '❌ Hide Task',
    ru: '❌ Скрыть задачу'
  };

  // إرسال رسالة العنوان
  await bot.sendMessage(chatId, headers[lang]);
  
  // إرسال كل مهمة في رسالة منفصلة
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const isOwner = task.is_owner === 1;
    
    let message = `${i + 1}. 🤖 ${task.bot_name}`;
    if (isOwner) {
      message += ` 👤 ${yourTaskText[lang]}`;
    }
    message += `\n`;
    message += `🆔 ID: ${task.id}\n`;
    
    // إضافة اسم صاحب المهمة
    if (!isOwner && task.owner_username) {
      const ownerTexts = {
        ar: '👤 صاحب المهمة',
        en: '👤 Task owner',
        ru: '👤 Владелец'
      };
      message += `${ownerTexts[lang]}: @${task.owner_username}\n`;
    }
    
    message += `💰 ${task.task_type === 'paid' ? `${task.reward_per_user} USDT` : exchangeText[lang]}\n`;
    message += `👥 ${task.completed_count}/${task.required_count}`;
    
    // إضافة التقييم إذا كان موجوداً
    if (!isOwner && task.owner_rating_count > 0) {
      const ratingEmoji = task.owner_rating >= 4 ? '⭐' : task.owner_rating >= 3 ? '🌟' : '⚠️';
      const ratingTexts = {
        ar: `${ratingEmoji} تقييم صاحب المهمة`,
        en: `${ratingEmoji} Task owner rating`,
        ru: `${ratingEmoji} Рейтинг владельца`
      };
      message += `\n${ratingTexts[lang]}: ${task.owner_rating}/5 (${task.owner_rating_count})`;
    }
    
    // إضافة أزرار فقط إذا لم يكن صاحب المهمة
    if (!isOwner) {
      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: executeText[lang], callback_data: `execute_task_${task.id}` },
              { text: hideText[lang], callback_data: `hide_task_${task.id}` }
            ]
          ]
        }
      };
      
      await bot.sendMessage(chatId, message, keyboard);
    } else {
      // إرسال بدون أزرار إذا كان صاحب المهمة
      await bot.sendMessage(chatId, message);
    }
  }
}

export async function handleTaskDetails(bot, msg, taskId) {
  const chatId = msg.chat.id;
  // التعامل مع كل من msg العادية و query.message
  const userId = msg.from ? msg.from.id : (msg.chat ? msg.chat.id : null);
  
  if (!userId) {
    logger.error('TASK_DETAILS', 'Cannot determine user ID from message');
    return;
  }
  
  const user = await User.findByTelegramId(userId);
  
  if (!user) {
    logger.error('TASK_DETAILS', `User ${userId} not found`);
    return;
  }

  const lang = user.language || 'ar';
  const task = await Task.getById(taskId);
  
  if (!task) {
    const messages = {
      ar: '❌ المهمة غير موجودة',
      en: '❌ Task not found',
      ru: '❌ Задача не найдена'
    };
    await bot.sendMessage(chatId, messages[lang]);
    return;
  }

  const hasSubmitted = await Submission.hasSubmitted(taskId, user.id);
  
  if (hasSubmitted) {
    const messages = {
      ar: '⚠️ لقد قمت بتنفيذ هذه المهمة من قبل',
      en: '⚠️ You have already completed this task',
      ru: '⚠️ Вы уже выполнили эту задачу'
    };
    await bot.sendMessage(chatId, messages[lang]);
    return;
  }

  const texts = {
    ar: {
      details: 'تفاصيل المهمة',
      bot: 'البوت',
      reward: 'المكافأة',
      exchange: '+1 نقطة تبادل',
      progress: 'التقدم',
      instructions: 'التعليمات',
      link: 'رابط الإحالة',
      proofType: 'نوع الإثبات',
      execute: '✅ تم',
      cancel: '❌ إلغاء'
    },
    en: {
      details: 'Task Details',
      bot: 'Bot',
      reward: 'Reward',
      exchange: '+1 Exchange Point',
      progress: 'Progress',
      instructions: 'Instructions',
      link: 'Referral link',
      proofType: 'Proof type',
      execute: '✅ Done',
      cancel: '❌ Cancel'
    },
    ru: {
      details: 'Детали задачи',
      bot: 'Бот',
      reward: 'Награда',
      exchange: '+1 Балл обмена',
      progress: 'Прогресс',
      instructions: 'Инструкции',
      link: 'Реферальная ссылка',
      proofType: 'Тип доказательства',
      execute: '✅ Готово',
      cancel: '❌ Отмена'
    }
  };

  const t = texts[lang];

  let message = `📋 ${t.details}:\n\n`;
  message += `🤖 ${t.bot}: ${task.bot_name}\n`;
  message += `💰 ${t.reward}: ${task.task_type === 'paid' ? `${task.reward_per_user} USDT` : t.exchange}\n`;
  message += `👥 ${t.progress}: ${task.completed_count}/${task.required_count}\n\n`;
  message += `📝 ${t.instructions}:\n${task.verification_instructions}\n\n`;
  message += `🔗 ${t.link}:\n${task.referral_link}\n\n`;
  message += `📸 ${t.proofType}: ${getProofTypeText(task.proof_type, lang)}`;

  await bot.sendMessage(chatId, message, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: t.execute, callback_data: `start_submit_${taskId}` },
          { text: t.cancel, callback_data: `cancel_task_${taskId}` }
        ]
      ]
    }
  });
}

function getProofTypeText(proofType, lang = 'ar') {
  const types = {
    ar: {
      'text': 'نص فقط',
      'images': 'صور فقط (حد أقصى 3)',
      'both': 'نص + صور (حد أقصى 3)'
    },
    en: {
      'text': 'Text only',
      'images': 'Images only (max 3)',
      'both': 'Text + images (max 3)'
    },
    ru: {
      'text': 'Только текст',
      'images': 'Только изображения (макс. 3)',
      'both': 'Текст + изображения (макс. 3)'
    }
  };
  return types[lang][proofType] || types['ar'][proofType] || 'غير محدد';
}

export async function handleTaskConfirmation(bot, query) {
  const chatId = query.message.chat.id;
  const state = userStates.get(chatId);
  
  if (!state) {
    await bot.answerCallbackQuery(query.id, { text: '❌ Session expired' });
    return;
  }

  const lang = state.lang || 'ar';

  if (query.data === 'cancel_create_task') {
    userStates.delete(chatId);
    
    // الحصول على لغة المستخدم الحالية من قاعدة البيانات
    const user = await User.findByTelegramId(query.from.id);
    const lang = user?.language || 'ar';
    
    const cancelMessages = {
      ar: '❌ تم إلغاء إنشاء المهمة',
      en: '❌ Task creation cancelled',
      ru: '❌ Создание задачи отменено'
    };
    
    await bot.editMessageText(cancelMessages[lang], {
      chat_id: chatId,
      message_id: query.message.message_id
    });
    
    await bot.answerCallbackQuery(query.id);
    
    // إرسال القائمة الرئيسية
    const isAdmin = await Admin.isAdmin(query.from.id);
    const mainMenuMessages = {
      ar: '📋 القائمة الرئيسية:',
      en: '📋 Main Menu:',
      ru: '📋 Главное меню:'
    };
    await bot.sendMessage(chatId, mainMenuMessages[lang], getMainMenuKeyboard(isAdmin, lang));
    return;
  }

  if (query.data === 'confirm_create_task') {
    try {
      logger.info(`Creating task: ${state.botName} (${state.taskType})`);
      
      // إذا كانت مهمة مدفوعة، خصم المبلغ من رصيد المستخدم
      if (state.taskType === 'paid') {
        const totalCost = state.totalCost || (state.rewardPerUser * state.requiredCount);
        
        // التحقق مرة أخرى من الرصيد قبل الخصم (للأمان)
        const user = await User.findById(state.userId);
        if (!user || user.balance < totalCost) {
          logger.error(`User ${state.userId} has insufficient balance at confirmation`);
          const messages = {
            ar: '❌ رصيدك غير كافٍ لإنشاء هذه المهمة',
            en: '❌ Your balance is insufficient to create this task',
            ru: '❌ Ваш баланс недостаточен для создания этой задачи'
          };
          await bot.editMessageText(messages[state.lang || 'ar'], {
            chat_id: chatId,
            message_id: query.message.message_id
          });
          await bot.answerCallbackQuery(query.id, { text: '❌' });
          userStates.delete(chatId);
          return;
        }
        
        // خصم المبلغ من رصيد المستخدم
        await User.updateBalance(state.userId, -totalCost);
        logger.success(`Deducted ${totalCost} USDT from user ${state.userId} balance`);
      }
      
      const taskId = await Task.create({
        ownerId: state.userId,
        botName: state.botName,
        referralLink: state.referralLink,
        requiredCount: state.requiredCount,
        taskType: state.taskType,
        rewardPerUser: state.rewardPerUser,
        verificationInstructions: state.verificationInstructions,
        proofType: state.proofType
      });

      logger.success(`Task created successfully with ID: ${taskId}`);

      // الحصول على لغة المستخدم الحالية من قاعدة البيانات
      const user = await User.findByTelegramId(query.from.id);
      const lang = user?.language || 'ar';
      
      // التحقق من أن المستخدم أدمن
      const isAdmin = await Admin.isAdmin(query.from.id);

      const successMessages = {
        ar: {
          created: 'تم إنشاء المهمة بنجاح',
          bot: 'البوت',
          required: 'العدد المطلوب',
          reward: 'المكافأة',
          exchange: '+1 نقطة تبادل',
          taskId: 'رقم المهمة',
          deducted: 'تم خصم',
          newBalance: 'رصيدك الجديد',
          backButton: 'رجوع للقائمة الرئيسية'
        },
        en: {
          created: 'Task created successfully',
          bot: 'Bot',
          required: 'Required count',
          reward: 'Reward',
          exchange: '+1 Exchange Point',
          taskId: 'Task ID',
          deducted: 'Deducted',
          newBalance: 'Your new balance',
          backButton: 'Back to main menu'
        },
        ru: {
          created: 'Задача успешно создана',
          bot: 'Бот',
          required: 'Требуется',
          reward: 'Награда',
          exchange: '+1 Балл обмена',
          taskId: 'ID задачи',
          deducted: 'Списано',
          newBalance: 'Ваш новый баланс',
          backButton: 'Вернуться в главное меню'
        }
      };

      const t = successMessages[lang];
      const rewardText = state.taskType === 'paid' ? `${state.rewardPerUser} USDT` : t.exchange;

      let message = `✅ ${t.created}!\n\n` +
        `🤖 ${t.bot}: ${state.botName}\n` +
        `👥 ${t.required}: ${state.requiredCount}\n` +
        `💰 ${t.reward}: ${rewardText}\n` +
        `🆔 ${t.taskId}: ${taskId}`;
      
      // إضافة معلومات الخصم إذا كانت مهمة مدفوعة
      if (state.taskType === 'paid') {
        const totalCost = state.totalCost || (state.rewardPerUser * state.requiredCount);
        const updatedUser = await User.findById(state.userId);
        message += `\n\n💸 ${t.deducted}: ${totalCost.toFixed(2)} USDT\n💰 ${t.newBalance}: ${updatedUser.balance.toFixed(2)} USDT`;
      }

      await bot.editMessageText(message, { 
        chat_id: chatId, 
        message_id: query.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: `🔙 ${t.backButton}`, callback_data: 'back_to_menu' }]
          ]
        }
      });

      await bot.answerCallbackQuery(query.id, { text: '✅' });

      // إرسال القائمة الرئيسية
      const mainMenuMessages = {
        ar: '📋 القائمة الرئيسية:',
        en: '📋 Main Menu:',
        ru: '📋 Главное меню:'
      };
      
      await bot.sendMessage(chatId, mainMenuMessages[lang], getMainMenuKeyboard(isAdmin, lang));

      userStates.delete(chatId);
    } catch (error) {
      // الحصول على لغة المستخدم الحالية من قاعدة البيانات في حالة الخطأ
      const user = await User.findByTelegramId(query.from.id);
      const lang = user?.language || 'ar';
      
      const errorMessages = {
        ar: '❌ حدث خطأ أثناء إنشاء المهمة',
        en: '❌ Error occurred while creating task',
        ru: '❌ Произошла ошибка при создании задачи'
      };
      await bot.editMessageText(errorMessages[lang], {
        chat_id: chatId,
        message_id: query.message.message_id
      });
      await bot.answerCallbackQuery(query.id, { text: '❌' });
      logger.error('TASK_CONFIRMATION', 'Error creating task', error);
      userStates.delete(chatId);
    }
  }
}
