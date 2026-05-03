import Task from '../models/Task.js';
import User from '../models/User.js';
import Submission from '../models/Submission.js';
import Settings from '../models/Settings.js';
import Report from '../models/Report.js';
import config from '../config.js';
import logger from '../utils/logger.js';
import { cancelKeyboard, mainMenu, reviewKeyboard, getRejectKeyboard, getReportKeyboard } from '../utils/keyboards.js';

const submissionStates = new Map();
const submissionTimers = new Map();
const rejectStates = new Map(); // لحفظ حالة الرفض مع الرسالة

export async function handleStartSubmission(bot, msg, taskId) {
  const chatId = msg.chat.id;
  const user = await User.findByTelegramId(msg.from.id);
  
  logger.user(`User ${msg.from.id} starting submission for task ${taskId}`);
  
  if (!user) {
    logger.warning(`User ${msg.from.id} not found`);
    return;
  }

  const lang = user.language || 'ar';
  const task = await Task.getById(taskId);
  
  if (!task) {
    logger.warning(`Task ${taskId} not found`);
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
    logger.warning(`User ${user.id} already submitted for task ${taskId}`);
    const messages = {
      ar: '⚠️ لقد قمت بتنفيذ هذه المهمة من قبل',
      en: '⚠️ You have already completed this task',
      ru: '⚠️ Вы уже выполнили эту задачу'
    };
    await bot.sendMessage(chatId, messages[lang]);
    return;
  }

  // الحصول على وقت المهلة
  const timeoutSeconds = await Settings.getTaskTimeout();
  const timeoutMinutes = Math.floor(timeoutSeconds / 60);

  logger.info(`Submission flow started for task ${taskId} by user ${user.id} (timeout: ${timeoutMinutes} minutes)`);

  submissionStates.set(chatId, {
    taskId,
    userId: user.id,
    task,
    step: 'awaiting_proof',
    proofText: null,
    proofImages: [],
    startTime: Date.now(),
    timeoutSeconds,
    lang
  });

  const texts = {
    ar: {
      title: '📤 إرسال الإثبات',
      timeAvailable: 'الوقت المتاح',
      minutes: 'دقيقة',
      proofTypeRequired: 'نوع الإثبات المطلوب',
      sendTextNow: 'أرسل النص الآن:',
      sendImagesNow: 'أرسل الصور الآن (حد أقصى 3):'
    },
    en: {
      title: '📤 Submit Proof',
      timeAvailable: 'Time available',
      minutes: 'minutes',
      proofTypeRequired: 'Required proof type',
      sendTextNow: 'Send text now:',
      sendImagesNow: 'Send images now (max 3):'
    },
    ru: {
      title: '📤 Отправить доказательство',
      timeAvailable: 'Доступное время',
      minutes: 'минут',
      proofTypeRequired: 'Требуемый тип доказательства',
      sendTextNow: 'Отправьте текст сейчас:',
      sendImagesNow: 'Отправьте изображения сейчас (макс. 3):'
    }
  };

  const t = texts[lang];

  let message = `${t.title}\n\n`;
  message += `⏱️ ${t.timeAvailable}: ${timeoutMinutes} ${t.minutes}\n\n`;
  message += `${t.proofTypeRequired}: ${getProofTypeText(task.proof_type, lang)}\n\n`;
  
  if (task.proof_type === 'text' || task.proof_type === 'both') {
    message += t.sendTextNow;
  } else {
    message += t.sendImagesNow;
  }

  await bot.sendMessage(chatId, message, cancelKeyboard);

  // إنشاء مؤقت للتحقق من انتهاء الوقت
  const timer = setTimeout(async () => {
    const currentState = submissionStates.get(chatId);
    if (currentState && currentState.taskId === taskId) {
      logger.warning(`Submission timeout for task ${taskId} by user ${user.id}`);
      submissionStates.delete(chatId);
      submissionTimers.delete(chatId);
      
      const lang = user.language || 'ar';
      const messages = {
        ar: '⏰ انتهى الوقت المخصص للمهمة!\n\n❌ تم إلغاء التقديم تلقائياً',
        en: '⏰ Time is up for this task!\n\n❌ Submission cancelled automatically',
        ru: '⏰ Время для этой задачи истекло!\n\n❌ Заявка отменена автоматически'
      };
      
      await bot.sendMessage(chatId, messages[lang], mainMenu);
    }
  }, timeoutSeconds * 1000);

  submissionTimers.set(chatId, timer);
}


export async function handleSubmissionSteps(bot, msg) {
  const chatId = msg.chat.id;
  const state = submissionStates.get(chatId);
  
  if (!state) return false;

  // إضافة logging لتتبع جميع الرسائل
  logger.info(`Submission step handler - Message text: "${msg.text}", Task: ${state.taskId}, Step: ${state.step}`);

  // معالجة زر الإلغاء بجميع اللغات
  if (msg.text === '❌ إلغاء' || msg.text === '❌ Cancel' || msg.text === '❌ Отмена') {
    // إلغاء المؤقت
    const timer = submissionTimers.get(chatId);
    if (timer) {
      clearTimeout(timer);
      submissionTimers.delete(chatId);
    }
    
    submissionStates.delete(chatId);
    
    const lang = state.lang || 'ar';
    const messages = {
      ar: '❌ تم إلغاء العملية',
      en: '❌ Operation cancelled',
      ru: '❌ Операция отменена'
    };
    
    await bot.sendMessage(chatId, messages[lang], mainMenu);
    return true;
  }

  // التحقق من انتهاء الوقت
  const elapsedSeconds = (Date.now() - state.startTime) / 1000;
  if (elapsedSeconds > state.timeoutSeconds) {
    const timer = submissionTimers.get(chatId);
    if (timer) {
      clearTimeout(timer);
      submissionTimers.delete(chatId);
    }
    
    submissionStates.delete(chatId);
    
    const lang = state.lang || 'ar';
    const messages = {
      ar: '⏰ انتهى الوقت المخصص للمهمة!',
      en: '⏰ Time is up for this task!',
      ru: '⏰ Время для этой задачи истекло!'
    };
    
    await bot.sendMessage(chatId, messages[lang], mainMenu);
    return true;
  }

  // معالجة زر "إرسال" بجميع اللغات
  if (msg.text === '✅ إرسال' || msg.text === '✅ Send' || msg.text === '✅ Отправить') {
    logger.info(`Send button pressed for task ${state.taskId} (text: "${msg.text}")`);
    logger.info(`Current state - Text: ${!!state.proofText}, Images: ${state.proofImages.length}, Type: ${state.task.proof_type}`);
    await finalizeSubmission(bot, chatId, state);
    return true;
  }
  
  // إذا لم يتطابق النص، نسجل ذلك
  if (msg.text && (msg.text.includes('Send') || msg.text.includes('إرسال') || msg.text.includes('Отправить'))) {
    logger.warning(`Send button text mismatch! Received: "${msg.text}" (length: ${msg.text.length})`);
    logger.warning(`Expected one of: "✅ إرسال", "✅ Send", "✅ Отправить"`);
    // محاولة معالجته على أي حال
    logger.info(`Attempting to finalize submission anyway...`);
    logger.info(`Current state - Text: ${!!state.proofText}, Images: ${state.proofImages.length}, Type: ${state.task.proof_type}`);
    await finalizeSubmission(bot, chatId, state);
    return true;
  }

  const task = state.task;

  // معالجة النص (لكن ليس إذا كان زر إرسال أو إلغاء)
  if (msg.text && 
      msg.text !== '✅ إرسال' && msg.text !== '✅ Send' && msg.text !== '✅ Отправить' &&
      msg.text !== '❌ إلغاء' && msg.text !== '❌ Cancel' && msg.text !== '❌ Отмена' &&
      (task.proof_type === 'text' || task.proof_type === 'both')) {
    logger.info(`Proof text received for task ${state.taskId}`);
    state.proofText = msg.text;
    
    if (task.proof_type === 'text') {
      await finalizeSubmission(bot, chatId, state);
      return true;
    } else {
      const remainingSeconds = state.timeoutSeconds - elapsedSeconds;
      const remainingMinutes = Math.floor(remainingSeconds / 60);
      const remainingSecs = Math.floor(remainingSeconds % 60);
      
      const lang = state.lang || 'ar';
      const messages = {
        ar: {
          textSaved: '✅ تم حفظ النص',
          timeRemaining: 'الوقت المتبقي',
          sendImagesOrSubmit: 'الآن أرسل الصور (حد أقصى 3) أو اضغط ✅ إرسال للإنهاء',
          send: '✅ إرسال',
          cancel: '❌ إلغاء'
        },
        en: {
          textSaved: '✅ Text saved',
          timeRemaining: 'Time remaining',
          sendImagesOrSubmit: 'Now send images (max 3) or press ✅ Send to finish',
          send: '✅ Send',
          cancel: '❌ Cancel'
        },
        ru: {
          textSaved: '✅ Текст сохранен',
          timeRemaining: 'Осталось времени',
          sendImagesOrSubmit: 'Теперь отправьте изображения (макс. 3) или нажмите ✅ Отправить',
          send: '✅ Отправить',
          cancel: '❌ Отмена'
        }
      };
      
      const t = messages[lang];
      
      await bot.sendMessage(
        chatId, 
        `${t.textSaved}\n\n⏱️ ${t.timeRemaining}: ${remainingMinutes}:${remainingSecs.toString().padStart(2, '0')}\n\n${t.sendImagesOrSubmit}`,
        {
          reply_markup: {
            keyboard: [[t.send, t.cancel]],
            resize_keyboard: true
          }
        }
      );
      return true;
    }
  }

  // معالجة الصور
  if (msg.photo && (task.proof_type === 'images' || task.proof_type === 'both')) {
    if (state.proofImages.length >= config.MAX_IMAGES) {
      logger.warning(`Max images reached for task ${state.taskId}`);
      const lang = state.lang || 'ar';
      const maxMessages = {
        ar: `❌ الحد الأقصى ${config.MAX_IMAGES} صور`,
        en: `❌ Maximum ${config.MAX_IMAGES} images`,
        ru: `❌ Максимум ${config.MAX_IMAGES} изображений`
      };
      await bot.sendMessage(chatId, maxMessages[lang]);
      return true;
    }

    const photo = msg.photo[msg.photo.length - 1];
    state.proofImages.push(photo.file_id);
    logger.info(`Image ${state.proofImages.length} added for task ${state.taskId}`);

    const remainingSeconds = state.timeoutSeconds - elapsedSeconds;
    const remainingMinutes = Math.floor(remainingSeconds / 60);
    const remainingSecs = Math.floor(remainingSeconds % 60);

    const lang = state.lang || 'ar';
    const messages = {
      ar: {
        imageAdded: '✅ تم إضافة الصورة',
        timeRemaining: 'الوقت المتبقي',
        maxReached: 'تم الوصول للحد الأقصى. اضغط ✅ إرسال',
        sendMoreOrSubmit: 'أرسل المزيد أو اضغط ✅ إرسال',
        send: '✅ إرسال',
        cancel: '❌ إلغاء'
      },
      en: {
        imageAdded: '✅ Image added',
        timeRemaining: 'Time remaining',
        maxReached: 'Maximum reached. Press ✅ Send',
        sendMoreOrSubmit: 'Send more or press ✅ Send',
        send: '✅ Send',
        cancel: '❌ Cancel'
      },
      ru: {
        imageAdded: '✅ Изображение добавлено',
        timeRemaining: 'Осталось времени',
        maxReached: 'Достигнут максимум. Нажмите ✅ Отправить',
        sendMoreOrSubmit: 'Отправьте еще или нажмите ✅ Отправить',
        send: '✅ Отправить',
        cancel: '❌ Отмена'
      }
    };
    
    const t = messages[lang];

    if (state.proofImages.length >= config.MAX_IMAGES) {
      await bot.sendMessage(
        chatId,
        `${t.imageAdded} (${state.proofImages.length}/${config.MAX_IMAGES})\n\n⏱️ ${t.timeRemaining}: ${remainingMinutes}:${remainingSecs.toString().padStart(2, '0')}\n\n${t.maxReached}`,
        {
          reply_markup: {
            keyboard: [[t.send, t.cancel]],
            resize_keyboard: true
          }
        }
      );
    } else {
      await bot.sendMessage(
        chatId,
        `${t.imageAdded} (${state.proofImages.length}/${config.MAX_IMAGES})\n\n⏱️ ${t.timeRemaining}: ${remainingMinutes}:${remainingSecs.toString().padStart(2, '0')}\n\n${t.sendMoreOrSubmit}`,
        {
          reply_markup: {
            keyboard: [[t.send, t.cancel]],
            resize_keyboard: true
          }
        }
      );
    }
    return true;
  }

  return false;
}


async function finalizeSubmission(bot, chatId, state) {
  const task = state.task;

  logger.info(`Finalizing submission for task ${state.taskId}`);
  logger.info(`Proof state - Text: ${!!state.proofText}, Images: ${state.proofImages.length}, Required type: ${task.proof_type}`);

  // إلغاء المؤقت
  const timer = submissionTimers.get(chatId);
  if (timer) {
    clearTimeout(timer);
    submissionTimers.delete(chatId);
  }

  // الحصول على لغة المستخدم من state (تم حفظها عند البدء)
  const lang = state.lang || 'ar';

  const errorMessages = {
    ar: {
      textRequired: '❌ يجب إرسال نص\n\n⚠️ لم تقم بإرسال نص بعد!\n\n📝 أرسل النص المطلوب',
      imageRequired: '❌ يجب إرسال صورة واحدة على الأقل\n\n⚠️ لم تقم بإرسال صورة بعد!\n\n📸 أرسل صورة واحدة على الأقل',
      bothRequired: '❌ يجب إرسال نص وصورة واحدة على الأقل\n\n⚠️ لم تقم بإرسال صورة بعد!\n\n📸 أرسل صورة واحدة على الأقل ثم اضغط ✅ إرسال'
    },
    en: {
      textRequired: '❌ You must send text\n\n⚠️ You haven\'t sent text yet!\n\n📝 Send the required text',
      imageRequired: '❌ You must send at least one image\n\n⚠️ You haven\'t sent an image yet!\n\n📸 Send at least one image',
      bothRequired: '❌ You must send text and at least one image\n\n⚠️ You haven\'t sent an image yet!\n\n📸 Send at least one image then press ✅ Send'
    },
    ru: {
      textRequired: '❌ Вы должны отправить текст\n\n⚠️ Вы еще не отправили текст!\n\n📝 Отправьте требуемый текст',
      imageRequired: '❌ Вы должны отправить хотя бы одно изображение\n\n⚠️ Вы еще не отправили изображение!\n\n📸 Отправьте хотя бы одно изображение',
      bothRequired: '❌ Вы должны отправить текст и хотя бы одно изображение\n\n⚠️ Вы еще не отправили изображение!\n\n📸 Отправьте хотя бы одно изображение, затем нажмите ✅ Отправить'
    }
  };

  const errors = errorMessages[lang];

  // إنشاء لوحة مفاتيح الإلغاء مع الترجمة
  const cancelTexts = {
    ar: '❌ إلغاء',
    en: '❌ Cancel',
    ru: '❌ Отмена'
  };
  
  const cancelKeyboardTranslated = {
    reply_markup: {
      keyboard: [[cancelTexts[lang]]],
      resize_keyboard: true
    }
  };

  // التحقق من الإثبات المطلوب
  if (task.proof_type === 'text' && !state.proofText) {
    logger.warning(`Missing text proof for task ${state.taskId}`);
    logger.info(`Sending text required error message in ${lang}`);
    await bot.sendMessage(chatId, errors.textRequired, cancelKeyboardTranslated);
    return;
  }

  if (task.proof_type === 'images' && state.proofImages.length === 0) {
    logger.warning(`Missing image proof for task ${state.taskId}`);
    logger.info(`Sending image required error message in ${lang}`);
    await bot.sendMessage(chatId, errors.imageRequired, cancelKeyboardTranslated);
    return;
  }

  if (task.proof_type === 'both' && (!state.proofText || state.proofImages.length === 0)) {
    logger.warning(`Missing text or image proof for task ${state.taskId}`);
    logger.info(`Proof state: text=${!!state.proofText}, images=${state.proofImages.length}`);
    logger.info(`Sending both required error message in ${lang}`);
    await bot.sendMessage(chatId, errors.bothRequired, cancelKeyboardTranslated);
    return;
  }

  try {
    const submissionId = await Submission.create({
      taskId: state.taskId,
      userId: state.userId,
      proofText: state.proofText,
      proofImages: JSON.stringify(state.proofImages)
    });

    logger.success(`Submission ${submissionId} created for task ${state.taskId}`);

    // زيادة عداد التقديمات المعلقة
    await Task.incrementPendingCount(state.taskId);
    logger.success(`Task ${state.taskId} pending count incremented`);

    const successMessages = {
      ar: '✅ تم إرسال الإثبات بنجاح!\n\n⏳ المهمة قيد المراجعة\n🆔 رقم التقديم: ',
      en: '✅ Proof submitted successfully!\n\n⏳ Task under review\n🆔 Submission ID: ',
      ru: '✅ Доказательство успешно отправлено!\n\n⏳ Задача на рассмотрении\n🆔 ID заявки: '
    };

    await bot.sendMessage(
      chatId,
      successMessages[lang] + submissionId,
      mainMenu
    );

    // إشعار المراجعين
    await notifyReviewers(bot, submissionId, task, state);

    submissionStates.delete(chatId);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      logger.warning(`Duplicate submission attempt for task ${state.taskId}`);
      await bot.sendMessage(chatId, '❌ لقد قمت بتنفيذ هذه المهمة من قبل', mainMenu);
    } else {
      logger.error(`Failed to create submission: ${error.message}`);
      await bot.sendMessage(chatId, '❌ حدث خطأ أثناء إرسال الإثبات', mainMenu);
      console.error(error);
    }
    submissionStates.delete(chatId);
  }
}


async function notifyReviewers(bot, submissionId, task, state) {
  logger.info(`Notifying reviewers about submission ${submissionId}`);
  
  // الحصول على معلومات المستخدم الذي قدم الإثبات
  const submission = await Submission.getById(submissionId);
  const submitterUser = await User.findByTelegramId(submission.user_telegram_id);
  
  let message = '🔔 إثبات جديد للمراجعة\n\n';
  message += `🆔 رقم التقديم: ${submissionId}\n`;
  message += `👤 المستخدم: ${submitterUser.username ? '@' + submitterUser.username : submission.user_telegram_id}\n`;
  message += `🤖 البوت: ${task.bot_name}\n`;
  message += `💰 المكافأة: ${task.task_type === 'paid' ? `${task.reward_per_user} USDT` : 'تبادل'}\n`;
  message += `📋 نوع الإثبات: ${getProofTypeText(task.proof_type, 'ar')}\n\n`;
  
  if (state.proofText) {
    message += `📝 النص:\n${state.proofText}\n\n`;
  }
  
  if (state.proofImages.length > 0) {
    message += `📸 عدد الصور: ${state.proofImages.length}\n\n`;
  }

  // إرسال للمسؤولين
  for (const adminId of config.ADMIN_IDS) {
    try {
      // إرسال الرسالة مع أزرار المراجعة
      await bot.sendMessage(adminId, message, reviewKeyboard(submissionId));
      
      // إرسال الصور إن وجدت
      if (state.proofImages.length > 0) {
        for (const imageId of state.proofImages) {
          await bot.sendPhoto(adminId, imageId, {
            caption: `📸 صورة الإثبات - التقديم #${submissionId}`
          });
        }
      }
      logger.success(`Admin ${adminId} notified about submission ${submissionId}`);
    } catch (error) {
      logger.error(`Failed to notify admin ${adminId}: ${error.message}`);
      console.error(`Failed to notify admin ${adminId}:`, error);
    }
  }
}

export async function handleReview(bot, query) {
  const data = query.data;
  const reviewerId = query.from.id;

  logger.callback(`Submission review action: ${data} by user ${reviewerId}`);

  // معالجة القبول
  if (data.startsWith('review_accept_')) {
    const submissionId = parseInt(data.split('_')[2]);
    const submission = await Submission.getById(submissionId);
    
    if (!submission) {
      await bot.answerCallbackQuery(query.id, { text: '❌ التقديم غير موجود' });
      return;
    }

    if (submission.status !== 'pending') {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ تمت المراجعة مسبقاً' });
      return;
    }

    // التحقق من الصلاحيات: أدمن أو صاحب المهمة
    const task = await Task.getById(submission.task_id);
    const reviewer = await User.findByTelegramId(reviewerId);
    
    const isAdmin = config.ADMIN_IDS.includes(reviewerId);
    const isTaskOwner = task && reviewer && task.owner_id === reviewer.id;
    
    if (!isAdmin && !isTaskOwner) {
      logger.warning(`Unauthorized review attempt by ${reviewerId}`);
      await bot.answerCallbackQuery(query.id, { text: '❌ غير مصرح لك' });
      return;
    }

    await Submission.updateStatus(submissionId, 'accept', reviewer.id);

    // إضافة المكافأة
    if (submission.task_type === 'paid') {
      await User.updateBalance(submission.user_id, submission.reward_per_user);
      logger.success(`Reward ${submission.reward_per_user} added to user ${submission.user_id}`);
    }

    logger.success(`Task ${submission.task_id} count remains unchanged (already counted on submission)`);

    // حذف الصور من قاعدة البيانات لتوفير المساحة
    await Submission.clearProofImages(submissionId);
    logger.success(`Proof images cleared for accepted submission ${submissionId}`);

    // إشعار المستخدم
    await bot.sendMessage(
      submission.user_telegram_id,
      `✅ تم قبول إثباتك!\n\n🆔 رقم التقديم: ${submissionId}\n💰 المكافأة: ${submission.task_type === 'paid' ? `${submission.reward_per_user} USDT` : 'تم احتساب إحالة'}`
    );

    await bot.editMessageText(
      query.message.text + '\n\n✅ تم القبول',
      { chat_id: query.message.chat.id, message_id: query.message.message_id }
    );

    await bot.answerCallbackQuery(query.id, { text: '✅ تم القبول' });
    return;
  }

  // معالجة الرفض - عرض الخيارات
  if (data.startsWith('review_reject_')) {
    const submissionId = parseInt(data.split('_')[2]);
    const submission = await Submission.getById(submissionId);
    
    if (!submission) {
      await bot.answerCallbackQuery(query.id, { text: '❌ التقديم غير موجود' });
      return;
    }

    if (submission.status !== 'pending') {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ تمت المراجعة مسبقاً' });
      return;
    }

    // التحقق من الصلاحيات: أدمن أو صاحب المهمة
    const task = await Task.getById(submission.task_id);
    const reviewer = await User.findByTelegramId(reviewerId);
    
    const isAdmin = config.ADMIN_IDS.includes(reviewerId);
    const isTaskOwner = task && reviewer && task.owner_id === reviewer.id;
    
    if (!isAdmin && !isTaskOwner) {
      logger.warning(`Unauthorized review attempt by ${reviewerId}`);
      await bot.answerCallbackQuery(query.id, { text: '❌ غير مصرح لك' });
      return;
    }

    await bot.answerCallbackQuery(query.id);
    
    // عرض خيارات الرفض
    await bot.sendMessage(
      query.message.chat.id,
      `❓ اختر نوع الرفض للتقديم #${submissionId}:`,
      getRejectKeyboard(submissionId)
    );
    return;
  }

  // معالجة الرفض مع فرصة ثانية
  if (data.startsWith('reject_retry_')) {
    const submissionId = parseInt(data.split('_')[2]);
    
    // حفظ حالة الرفض وانتظار الرسالة
    rejectStates.set(query.message.chat.id, {
      submissionId,
      type: 'retry',
      reviewerId
    });

    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(
      query.message.chat.id,
      `📝 أرسل رسالة للمستخدم توضح سبب الرفض وكيف يمكنه تحسين الإثبات:\n\n(سيتم إرسال الرسالة للمستخدم مع إمكانية إعادة المحاولة)`,
      {
        reply_markup: {
          keyboard: [['❌ إلغاء']],
          resize_keyboard: true
        }
      }
    );
    return;
  }

  // معالجة الرفض النهائي
  if (data.startsWith('reject_final_')) {
    const submissionId = parseInt(data.split('_')[2]);
    
    // حفظ حالة الرفض وانتظار الرسالة
    rejectStates.set(query.message.chat.id, {
      submissionId,
      type: 'final',
      reviewerId
    });

    await bot.answerCallbackQuery(query.id);
    await bot.sendMessage(
      query.message.chat.id,
      `📝 أرسل رسالة للمستخدم توضح سبب الرفض النهائي:\n\n(سيتم إرسال الرسالة للمستخدم مع إمكانية الإبلاغ عن صاحب المهمة)`,
      {
        reply_markup: {
          keyboard: [['❌ إلغاء']],
          resize_keyboard: true
        }
      }
    );
    return;
  }
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
  return types[lang]?.[proofType] || types['ar'][proofType] || 'غير محدد';
}


// معالجة رسائل الرفض من الأدمن
export async function handleRejectMessage(bot, msg) {
  const chatId = msg.chat.id;
  const state = rejectStates.get(chatId);
  
  if (!state) return false;

  // معالجة زر الإلغاء
  if (msg.text === '❌ إلغاء') {
    rejectStates.delete(chatId);
    await bot.sendMessage(chatId, '❌ تم إلغاء العملية');
    return true;
  }

  const { submissionId, type, reviewerId } = state;
  const rejectMessage = msg.text;

  try {
    const submission = await Submission.getById(submissionId);
    
    if (!submission) {
      await bot.sendMessage(chatId, '❌ التقديم غير موجود');
      rejectStates.delete(chatId);
      return true;
    }

    const user = await User.findByTelegramId(reviewerId);
    
    // تحديث حالة التقديم
    await Submission.updateStatus(submissionId, 'reject', user.id);
    await Submission.updateRejection(submissionId, type, rejectMessage, type === 'retry');

    // نقصان العداد عند الرفض
    await Task.decrementPendingCount(submission.task_id);
    logger.success(`Task ${submission.task_id} pending count decremented due to rejection`);

    if (type === 'retry') {
      // رفض مع فرصة ثانية - لا نحذف الصور وتعيين مهلة التحسين
      const improvementTimeout = await Settings.getImprovementTimeout();
      await Submission.setImprovementDeadline(submissionId, improvementTimeout);
      
      const timeoutMinutes = Math.floor(improvementTimeout / 60);
      
      await bot.sendMessage(
        submission.user_telegram_id,
        `⚠️ تم رفض إثباتك مع إمكانية إعادة المحاولة\n\n` +
        `🆔 رقم التقديم: ${submissionId}\n` +
        `🤖 المهمة: ${submission.bot_name}\n\n` +
        `📝 سبب الرفض:\n${rejectMessage}\n\n` +
        `💡 يمكنك تحسين الإثبات والمحاولة مرة أخرى\n` +
        `⏰ المهلة المتاحة: ${timeoutMinutes} دقيقة`
      );

      await bot.sendMessage(chatId, `✅ تم رفض التقديم #${submissionId} مع إعطاء فرصة ثانية (مهلة: ${timeoutMinutes} دقيقة)`);
    } else {
      // رفض نهائي - حذف الصور من قاعدة البيانات
      await Submission.clearProofImages(submissionId);
      logger.success(`Proof images cleared for rejected submission ${submissionId}`);
      
      const taskOwner = await Submission.getTaskOwner(submissionId);
      
      await bot.sendMessage(
        submission.user_telegram_id,
        `❌ تم رفض إثباتك بشكل نهائي\n\n` +
        `🆔 رقم التقديم: ${submissionId}\n` +
        `🤖 المهمة: ${submission.bot_name}\n\n` +
        `📝 سبب الرفض:\n${rejectMessage}\n\n` +
        `⚠️ إذا كنت تعتقد أن هذا الرفض ظالم، يمكنك الإبلاغ عن صاحب المهمة`,
        getReportKeyboard(submissionId, taskOwner.owner_id)
      );

      await bot.sendMessage(chatId, `✅ تم رفض التقديم #${submissionId} بشكل نهائي`);
    }

    rejectStates.delete(chatId);
    return true;
  } catch (error) {
    logger.error(`Failed to process rejection: ${error.message}`);
    await bot.sendMessage(chatId, '❌ حدث خطأ أثناء معالجة الرفض');
    rejectStates.delete(chatId);
    return true;
  }
}

// معالجة الإبلاغات
export async function handleReport(bot, query) {
  const data = query.data;
  const reporterId = query.from.id;

  if (data.startsWith('report_user_')) {
    const parts = data.split('_');
    const submissionId = parseInt(parts[2]);
    const reportedUserId = parseInt(parts[3]);

    await bot.answerCallbackQuery(query.id);

    const reporter = await User.findByTelegramId(reporterId);
    
    if (!reporter) {
      await bot.sendMessage(query.message.chat.id, '❌ خطأ في التحقق من المستخدم');
      return;
    }

    // التحقق من السبام - 5 إبلاغات في 5 دقائق
    const recentReports = await Report.getRecentReportsByUser(reporter.id, 5);
    
    if (recentReports >= 5) {
      logger.warning(`User ${reporter.id} is spamming reports - banning`);
      
      await User.banUser(reporter.id);
      
      const supportText = await Settings.getSupportText(reporter.language || 'ar');
      
      await bot.sendMessage(
        query.message.chat.id,
        `🚫 تم حظرك من البوت بسبب إرسال إبلاغات متكررة (سبام)\n\n` +
        `⚠️ إذا كنت تعتقد أن هذا خطأ، تواصل مع الدعم:\n\n${supportText}`
      );
      return;
    }

    // التحقق من وجود إبلاغ سابق
    const hasReported = await Report.hasReported(reporter.id, reportedUserId, submissionId);
    
    if (hasReported) {
      await bot.sendMessage(query.message.chat.id, '⚠️ لقد قمت بالإبلاغ عن هذا المستخدم من قبل');
      return;
    }

    const submission = await Submission.getById(submissionId);
    
    if (!submission) {
      await bot.sendMessage(query.message.chat.id, '❌ التقديم غير موجود');
      return;
    }

    // إنشاء الإبلاغ
    const reportId = await Report.create({
      reporterId: reporter.id,
      reportedUserId,
      taskId: submission.task_id,
      submissionId,
      reason: `رفض نهائي للتقديم #${submissionId}`
    });

    logger.success(`Report ${reportId} created by user ${reporter.id} against user ${reportedUserId}`);

    // التحقق من عدد الإبلاغات على المستخدم المبلغ عنه
    const reportCount = await Report.getReportCount(reportedUserId);
    
    const reportedUser = await User.findById(reportedUserId);
    
    if (reportCount >= 5) {
      // حظر المستخدم بعد 5 إبلاغات من 5 مستخدمين مختلفين
      logger.warning(`User ${reportedUserId} received 5 reports - banning`);
      
      await User.banUser(reportedUserId);
      await Report.clearReports(reportedUserId);
      
      const supportText = await Settings.getSupportText(reportedUser.language || 'ar');
      
      await bot.sendMessage(
        reportedUser.telegram_id,
        `🚫 تم حظرك من البوت بسبب تلقي 5 إبلاغات من مستخدمين مختلفين\n\n` +
        `⚠️ إذا كنت تعتقد أن هذا خطأ، تواصل مع الدعم:\n\n${supportText}`
      );

      await bot.sendMessage(
        query.message.chat.id,
        `✅ تم إرسال الإبلاغ بنجاح\n\n` +
        `⚠️ المستخدم المبلغ عنه تلقى 5 إبلاغات وتم حظره تلقائياً`
      );

      // إشعار الأدمن
      for (const adminId of config.ADMIN_IDS) {
        try {
          await bot.sendMessage(
            adminId,
            `🚨 تم حظر مستخدم تلقائياً بعد 5 إبلاغات\n\n` +
            `👤 المستخدم: ${reportedUser.username ? '@' + reportedUser.username : reportedUser.telegram_id}\n` +
            `🆔 ID: ${reportedUser.telegram_id}\n` +
            `📊 عدد الإبلاغات: ${reportCount}`
          );
        } catch (error) {
          logger.error(`Failed to notify admin ${adminId}: ${error.message}`);
        }
      }
    } else {
      await bot.sendMessage(
        query.message.chat.id,
        `✅ تم إرسال الإبلاغ بنجاح\n\n` +
        `📊 عدد الإبلاغات على هذا المستخدم: ${reportCount}/5\n\n` +
        `سيتم مراجعة الإبلاغ من قبل الإدارة`
      );

      // إشعار الأدمن
      const taskOwner = await Submission.getTaskOwner(submissionId);
      
      for (const adminId of config.ADMIN_IDS) {
        try {
          await bot.sendMessage(
            adminId,
            `🚨 إبلاغ جديد\n\n` +
            `👤 المبلغ: ${reporter.username ? '@' + reporter.username : reporter.telegram_id}\n` +
            `👤 المبلغ عنه: ${taskOwner.username ? '@' + taskOwner.username : taskOwner.telegram_id}\n` +
            `🆔 رقم التقديم: ${submissionId}\n` +
            `📊 عدد الإبلاغات: ${reportCount}/5`
          );
        } catch (error) {
          logger.error(`Failed to notify admin ${adminId}: ${error.message}`);
        }
      }
    }
  }
}
