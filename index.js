import TelegramBot from 'node-telegram-bot-api';
import config from './config.js';
import db from './database.js';
import User from './models/User.js';
import Admin from './models/Admin.js';
import Task from './models/Task.js';
import Submission from './models/Submission.js';
import Settings from './models/Settings.js';
import HiddenTask from './models/HiddenTask.js';
import Deposit from './models/Deposit.js';
import ViolationSystem from './utils/violationSystem.js';
import Ban from './models/Ban.js';
import Restriction from './models/Restriction.js';
import Violation from './models/Violation.js';
import Statistics from './models/Statistics.js';
import Rating from './models/Rating.js';
import Broadcast from './models/Broadcast.js';
import Appeal from './models/Appeal.js';
import { mainMenu, adminMenu, adminPanelKeyboard, mainAdminPanelKeyboard, userLanguageKeyboard, getMainMenuKeyboard, depositReviewKeyboard } from './utils/keyboards.js';
import { logInfo, logSuccess, logError, logUser, logCommand, logCallback, logSeparator } from './utils/logger.js';
import {
  handleAddTask,
  handleTaskType,
  handleTaskCreationSteps,
  handleProofType,
  handleViewTasks,
  handleTaskDetails
} from './handlers/taskHandler.js';
import {
  handleStartSubmission,
  handleSubmissionSteps,
  handleReview,
  handleRejectMessage,
  handleReport
} from './handlers/submissionHandler.js';
import {
  handleStartDeposit,
  handleDepositMethod,
  handleDepositSteps,
  handleDepositReview,
  handleDepositRejectReason,
  depositStates as depositStatesMap
} from './handlers/depositHandler.js';
import {
  handleStartWithdrawal,
  handleWithdrawalMethod,
  handleWithdrawalSteps,
  handleWithdrawalReview,
  handleWithdrawalRejectReason
} from './handlers/withdrawalHandler.js';
import {
  handleAdminPanel,
  handleSearchUser,
  handleEditSupportText,
  handleAdminSteps,
  handleLanguageSelection,
  handleManageAdmins,
  handleAddAdmin,
  handleRemoveAdmin,
  adminStates as adminStatesFromHandler
} from './handlers/adminHandler.js';
import {
  handleStatistics,
  handleTopUsers
} from './handlers/statisticsHandler.js';
import {
  handleRateUser,
  handleRatingSelection,
  handleSkipComment,
  handleRatingComment,
  handleViewRatings,
  ratingStates
} from './handlers/ratingHandler.js';
import {
  handleStartBroadcast,
  handleBroadcastTarget,
  handleBroadcastMessage,
  handleBroadcastSend,
  handleBroadcastCancel,
  handleBroadcastHistory,
  broadcastStates
} from './handlers/broadcastHandler.js';
import {
  handleStartAppeal,
  handleAppealReason,
  handleAppealReview,
  handleAppealRejectNote,
  handleViewAppeals,
  appealStates
} from './handlers/appealHandler.js';

const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });

logSeparator();
logSuccess('BOT', '🤖 البوت يعمل الآن...');
logInfo('CONFIG', `Admin IDs: ${config.ADMIN_IDS.join(', ')}`);
logSeparator();

console.log('🤖 البوت يعمل الآن...');

// ===== Middleware للتحقق من الحظر =====
// يتم تطبيقه على جميع الرسائل قبل معالجتها
bot.on('message', async (msg) => {
  // تجاهل رسائل الأدمن (رئيسي وثانوي)
  const isAdmin = await Admin.isAdmin(msg.from.id);
  if (isAdmin) {
    return; // السماح للأدمن بالمرور
  }

  try {
    const user = await User.findByTelegramId(msg.from.id);
    
    if (!user) {
      return; // المستخدم غير موجود، سيتم إنشاؤه في /start
    }

    // فحص حالة المستخدم (الحظر والتقييدات)
    const userStatus = await ViolationSystem.checkUserStatus(user.id);
    
    if (!userStatus.allowed) {
      const lang = user.language || 'ar';
      const banMessage = ViolationSystem.getBanMessage(
        userStatus.banStatus,
        userStatus.remaining,
        lang
      );
      
      if (banMessage) {
        await bot.sendMessage(msg.chat.id, banMessage);
        logWarning('MIDDLEWARE', `Blocked banned user ${msg.from.id} from using the bot`);
        
        // إيقاف معالجة الرسالة
        msg.handled = true;
      }
    }
  } catch (error) {
    logError('MIDDLEWARE', 'Error checking user ban status', error);
  }
});

// مهمة دورية لإلغاء الإثباتات المنتهية (كل 5 دقائق)
setInterval(async () => {
  try {
    const disabledCount = await Submission.disableExpiredImprovements();
    if (disabledCount > 0) {
      logInfo('CLEANUP', `Disabled ${disabledCount} expired improvement opportunities`);
    }
  } catch (error) {
    logError('CLEANUP', 'Failed to disable expired improvements', error);
  }
}, 5 * 60 * 1000); // كل 5 دقائق

// مهمة دورية لرفع الحظر المؤقت المنتهي (كل 10 دقائق)
setInterval(async () => {
  try {
    const liftedCount = await Ban.liftExpiredBans();
    if (liftedCount > 0) {
      logInfo('CLEANUP', `Lifted ${liftedCount} expired temporary bans`);
      
      // تحديث حالة المستخدمين
      for (let i = 0; i < liftedCount; i++) {
        // سيتم تحديث الحالة تلقائياً عند التحقق من المستخدم
      }
    }
  } catch (error) {
    logError('CLEANUP', 'Failed to lift expired bans', error);
  }
}, 10 * 60 * 1000); // كل 10 دقائق

// مهمة دورية لرفع التقييدات المنتهية (كل 10 دقائق)
setInterval(async () => {
  try {
    const liftedCount = await Restriction.liftExpiredRestrictions();
    if (liftedCount > 0) {
      logInfo('CLEANUP', `Lifted ${liftedCount} expired restrictions`);
    }
  } catch (error) {
    logError('CLEANUP', 'Failed to lift expired restrictions', error);
  }
}, 10 * 60 * 1000); // كل 10 دقائق

// مهمة دورية لإعادة تأهيل المستخدمين (كل يوم)
setInterval(async () => {
  try {
    const rehabilitatedCount = await Violation.rehabilitateUsers();
    if (rehabilitatedCount > 0) {
      logInfo('CLEANUP', `Rehabilitated ${rehabilitatedCount} users (reduced violation points)`);
    }
  } catch (error) {
    logError('CLEANUP', 'Failed to rehabilitate users', error);
  }
}, 24 * 60 * 60 * 1000); // كل 24 ساعة

// مهمة دورية لتنظيف الحالات القديمة (كل 5 دقائق)
setInterval(() => {
  try {
    const now = Date.now();
    const timeout = 30 * 60 * 1000; // 30 دقيقة
    let cleanedCount = 0;

    // تنظيف حالات التقييمات
    for (const [chatId, state] of ratingStates.entries()) {
      if (state.timestamp && now - state.timestamp > timeout) {
        ratingStates.delete(chatId);
        cleanedCount++;
      }
    }

    // تنظيف حالات الرسائل الجماعية
    for (const [chatId, state] of broadcastStates.entries()) {
      if (state.timestamp && now - state.timestamp > timeout) {
        broadcastStates.delete(chatId);
        cleanedCount++;
      }
    }

    // تنظيف حالات الاستئنافات
    for (const [chatId, state] of appealStates.entries()) {
      if (state.timestamp && now - state.timestamp > timeout) {
        appealStates.delete(chatId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logInfo('CLEANUP', `Cleaned ${cleanedCount} expired states`);
    }
  } catch (error) {
    logError('CLEANUP', 'Failed to clean expired states', error);
  }
}, 5 * 60 * 1000); // كل 5 دقائق

// معالج الأوامر الأساسية
bot.onText(/\/start/, async (msg) => {
  if (msg.handled) return; // تم حظر المستخدم
  
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const username = msg.from.username || msg.from.first_name;

  logCommand('/start', telegramId, username);

  try {
    await User.create(telegramId, username);
    logUser('REGISTER', telegramId, username);
    
    // الحصول على لغة المستخدم
    const user = await User.findByTelegramId(telegramId);
    const userLang = user?.language || 'ar';
    logInfo('START', `User language: ${userLang}`);
    
    // فحص حالة المستخدم (الحظر والتقييدات) - للمستخدمين الجدد فقط
    const isAdmin = await Admin.isAdmin(telegramId);
    if (user && !isAdmin) {
      const userStatus = await ViolationSystem.checkUserStatus(user.id);
      
      if (!userStatus.allowed) {
        const banMessage = ViolationSystem.getBanMessage(
          userStatus.banStatus,
          userStatus.remaining,
          userLang
        );
        
        if (banMessage) {
          await bot.sendMessage(chatId, banMessage);
          logWarning('START', `Banned user ${telegramId} tried to start the bot`);
          return;
        }
      }
    }
    
    const welcomeMessages = {
      ar: `مرحباً ${username}! 👋\n\n🤖 هذا بوت تبادل الإحالات والمهام المدفوعة\n\n📋 يمكنك:\n• تنفيذ مهام وكسب المال\n• إضافة مهام لبوتك الخاص\n• تبادل الإحالات مع الآخرين\n\nاستخدم القائمة أدناه للبدء 👇`,
      en: `Welcome ${username}! 👋\n\n🤖 This is a referral exchange and paid tasks bot\n\n📋 You can:\n• Complete tasks and earn money\n• Add tasks for your own bot\n• Exchange referrals with others\n\nUse the menu below to get started 👇`,
      ru: `Добро пожаловать ${username}! 👋\n\n🤖 Это бот для обмена рефералами и платных задач\n\n📋 Вы можете:\n• Выполнять задачи и зарабатывать деньги\n• Добавлять задачи для своего бота\n• Обмениваться рефералами с другими\n\nИспользуйте меню ниже для начала 👇`
    };

    const isAdminUser = await Admin.isAdmin(telegramId);
    const menu = getMainMenuKeyboard(isAdminUser, userLang);
    
    await bot.sendMessage(chatId, welcomeMessages[userLang], menu);
    
    logSuccess('START', `User ${telegramId} started the bot in ${userLang}`);
  } catch (error) {
    logError('START', 'Error in /start command', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ، حاول مرة أخرى');
  }
});

// معالج معلومات المستخدم - يدعم جميع اللغات
bot.onText(/ℹ️ معلوماتي|ℹ️ My Info|ℹ️ Моя информация/, async (msg) => {
  if (msg.handled) return; // تم حظر المستخدم
  
  const chatId = msg.chat.id;
  logCommand('ℹ️ My Info', msg.from.id, msg.from.username);
  
  const user = await User.findByTelegramId(msg.from.id);
  
  if (!user) return;

  const balance = await User.getBalance(user.id);
  const exchangePoints = await User.getExchangePoints(user.id);
  const lang = user.language || 'ar';
  
  logInfo('INFO', `User ${msg.from.id} viewing info`);
  
  const messages = {
    ar: `ℹ️ معلوماتك:\n\n` +
        `🆔 معرف التليجرام: \`${msg.from.id}\`\n` +
        `👛 المحفظة: ${balance.toFixed(2)} USDT\n` +
        `🔄 نقاط الإحالات المتبادلة: ${exchangePoints}\n\n` +
        `📝 ملاحظة: نقاط الإحالات تزيد عند تنفيذك لمهام الآخرين (+1) وتنقص عند تنفيذ الآخرين لمهامك (-1)`,
    en: `ℹ️ Your Information:\n\n` +
        `🆔 Telegram ID: \`${msg.from.id}\`\n` +
        `👛 Wallet: ${balance.toFixed(2)} USDT\n` +
        `🔄 Exchange Points: ${exchangePoints}\n\n` +
        `📝 Note: Exchange points increase when you complete others' tasks (+1) and decrease when others complete your tasks (-1)`,
    ru: `ℹ️ Ваша информация:\n\n` +
        `🆔 Telegram ID: \`${msg.from.id}\`\n` +
        `👛 Кошелек: ${balance.toFixed(2)} USDT\n` +
        `🔄 Баллы обмена: ${exchangePoints}\n\n` +
        `📝 Примечание: Баллы обмена увеличиваются, когда вы выполняете задачи других (+1), и уменьшаются, когда другие выполняют ваши задачи (-1)`
  };
  
  await bot.sendMessage(chatId, messages[lang], { parse_mode: 'Markdown' });
});

// معالج مهام المستخدم - يدعم جميع اللغات
bot.onText(/📊 مهامي|📊 My Tasks|📊 Мои задачи/, async (msg) => {
  if (msg.handled) return; // تم حظر المستخدم
  
  const chatId = msg.chat.id;
  logCommand('📊 My Tasks', msg.from.id, msg.from.username);
  
  try {
    const user = await User.findByTelegramId(msg.from.id);
    
    if (!user) {
      logError('MY_TASKS', `User ${msg.from.id} not found`);
      return;
    }

    const lang = user.language || 'ar';
    const tasks = await Task.getUserTasks(user.id);

    if (tasks.length === 0) {
      const messages = {
        ar: '❌ ليس لديك مهام',
        en: '❌ You have no tasks',
        ru: '❌ У вас нет задач'
      };
      await bot.sendMessage(chatId, messages[lang]);
      return;
    }

    const headers = {
      ar: '📊 مهامك:',
      en: '📊 Your tasks:',
      ru: '📊 Ваши задачи:'
    };
    
    await bot.sendMessage(chatId, headers[lang]);
    
    // إرسال كل مهمة في رسالة منفصلة
    for (const task of tasks) {
      try {
        // التحقق من وجود تقديمات معلقة
        const pendingCount = await Task.getPendingSubmissionsCount(task.id);
        
        let message = `🆔 ${task.id} - ${task.bot_name}\n`;
        
        const statusTexts = {
          ar: task.status === 'active' ? '🟢 نشط' : '🔴 متوقف',
          en: task.status === 'active' ? '🟢 Active' : '🔴 Stopped',
          ru: task.status === 'active' ? '🟢 Активна' : '🔴 Остановлена'
        };
        
        const progressTexts = {
          ar: 'التقدم',
          en: 'Progress',
          ru: 'Прогресс'
        };
        
        const pendingTexts = {
          ar: 'تقديمات معلقة',
          en: 'Pending submissions',
          ru: 'Ожидающие заявки'
        };
        
        const typeTexts = {
          ar: task.task_type === 'paid' ? `${task.reward_per_user} USDT` : 'تبادل',
          en: task.task_type === 'paid' ? `${task.reward_per_user} USDT` : 'Exchange',
          ru: task.task_type === 'paid' ? `${task.reward_per_user} USDT` : 'Обмен'
        };
        
        message += `📊 ${lang === 'ar' ? 'الحالة' : lang === 'en' ? 'Status' : 'Статус'}: ${statusTexts[lang]}\n`;
        message += `👥 ${progressTexts[lang]}: ${task.completed_count}/${task.required_count}\n`;
        message += `💰 ${typeTexts[lang]}`;
        
        if (pendingCount > 0) {
          message += `\n⏳ ${pendingTexts[lang]}: ${pendingCount}`;
        }
        
        const keyboard = [];
        
        // إضافة أزرار حسب الحالة
        if (task.status === 'active') {
          if (pendingCount > 0) {
            // إذا كان هناك تقديمات معلقة، عرض زر الإيقاف
            const pauseTexts = {
              ar: '⏸️ إيقاف',
              en: '⏸️ Pause',
              ru: '⏸️ Пауза'
            };
            keyboard.push([
              { text: pauseTexts[lang], callback_data: `pause_task_${task.id}` }
            ]);
          } else {
            // إذا لم يكن هناك تقديمات معلقة، عرض زر الحذف
            const deleteTexts = {
              ar: '🗑 حذف',
              en: '🗑 Delete',
              ru: '🗑 Удалить'
            };
            keyboard.push([
              { text: deleteTexts[lang], callback_data: `delete_task_${task.id}` }
            ]);
          }
        } else {
          // المهمة متوقفة
          if (pendingCount > 0) {
            // لا يزال هناك تقديمات معلقة
            const resumeTexts = {
              ar: '▶️ تفعيل',
              en: '▶️ Resume',
              ru: '▶️ Возобновить'
            };
            keyboard.push([
              { text: resumeTexts[lang], callback_data: `resume_task_${task.id}` }
            ]);
          } else {
            // لا توجد تقديمات معلقة، يمكن الحذف أو التفعيل
            const resumeTexts = {
              ar: '▶️ تفعيل',
              en: '▶️ Resume',
              ru: '▶️ Возобновить'
            };
            const deleteTexts = {
              ar: '🗑 حذف',
              en: '🗑 Delete',
              ru: '🗑 Удалить'
            };
            keyboard.push([
              { text: resumeTexts[lang], callback_data: `resume_task_${task.id}` },
              { text: deleteTexts[lang], callback_data: `delete_task_${task.id}` }
            ]);
          }
        }

        // إضافة زر التقديمات لجميع المهام
        const submissionsTexts = {
          ar: '📝 التقديمات',
          en: '📝 Submissions',
          ru: '📝 Заявки'
        };
        keyboard.push([
          { text: submissionsTexts[lang], callback_data: `task_submissions_${task.id}` }
        ]);

        await bot.sendMessage(chatId, message, {
          reply_markup: {
            inline_keyboard: keyboard
          }
        });
      } catch (taskError) {
        logError('MY_TASKS', `Error processing task ${task.id}`, taskError);
        console.error(`Error processing task ${task.id}:`, taskError);
      }
    }
  } catch (error) {
    logError('MY_TASKS', 'Error in My Tasks handler', error);
    console.error('Error in My Tasks handler:', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ أثناء جلب المهام');
  }
});

// معالج إثباتاتي - يدعم جميع اللغات مع تفاصيل كاملة
bot.onText(/📝 إثباتاتي|📝 My Submissions|📝 Мои заявки/, async (msg) => {
  if (msg.handled) return; // تم حظر المستخدم
  
  const chatId = msg.chat.id;
  logCommand('📝 My Submissions', msg.from.id, msg.from.username);
  
  const user = await User.findByTelegramId(msg.from.id);
  
  if (!user) return;

  const lang = user.language || 'ar';
  const submissions = await Submission.getUserSubmissionsWithDetails(user.id);

  if (submissions.length === 0) {
    const messages = {
      ar: '❌ ليس لديك إثباتات',
      en: '❌ You have no submissions',
      ru: '❌ У вас нет заявок'
    };
    await bot.sendMessage(chatId, messages[lang]);
    return;
  }

  const headers = {
    ar: '📝 إثباتاتك:',
    en: '📝 Your submissions:',
    ru: '📝 Ваши заявки:'
  };
  
  await bot.sendMessage(chatId, headers[lang]);
  
  // إرسال كل إثبات في رسالة منفصلة مع التفاصيل الكاملة
  for (const submission of submissions) {
    const statusEmoji = {
      pending: '⏳',
      accept: '✅',
      reject: '❌'
    };
    
    const statusTexts = {
      ar: {
        pending: 'قيد المراجعة',
        accept: 'مقبول',
        reject: 'مرفوض'
      },
      en: {
        pending: 'Under Review',
        accept: 'Accepted',
        reject: 'Rejected'
      },
      ru: {
        pending: 'На рассмотрении',
        accept: 'Принято',
        reject: 'Отклонено'
      }
    };
    
    const rewardTexts = {
      ar: submission.task_type === 'paid' ? `${submission.reward_per_user} USDT` : '+1 نقطة تبادل',
      en: submission.task_type === 'paid' ? `${submission.reward_per_user} USDT` : '+1 Exchange Point',
      ru: submission.task_type === 'paid' ? `${submission.reward_per_user} USDT` : '+1 Балл обмена'
    };
    
    const labels = {
      ar: {
        status: 'الحالة',
        reward: 'المكافأة',
        task: 'المهمة',
        owner: 'صاحب المهمة',
        sentDate: 'تاريخ الإرسال',
        reviewDate: 'تاريخ المراجعة',
        rejectReason: 'سبب الرفض'
      },
      en: {
        status: 'Status',
        reward: 'Reward',
        task: 'Task',
        owner: 'Task Owner',
        sentDate: 'Sent Date',
        reviewDate: 'Review Date',
        rejectReason: 'Rejection Reason'
      },
      ru: {
        status: 'Статус',
        reward: 'Награда',
        task: 'Задача',
        owner: 'Владелец задачи',
        sentDate: 'Дата отправки',
        reviewDate: 'Дата проверки',
        rejectReason: 'Причина отклонения'
      }
    };
    
    const l = labels[lang];
    
    let message = `🆔 ${submission.id}\n`;
    message += `${statusEmoji[submission.status]} ${l.status}: ${statusTexts[lang][submission.status]}\n`;
    message += `💰 ${l.reward}: ${rewardTexts[lang]}\n`;
    message += `🤖 ${l.task}: ${submission.bot_name}\n`;
    message += `👤 ${l.owner}: ${submission.owner_username ? '@' + submission.owner_username : submission.owner_telegram_id}\n`;
    message += `📅 ${l.sentDate}: ${new Date(submission.created_at).toLocaleString(lang === 'ar' ? 'ar-SA' : lang === 'en' ? 'en-US' : 'ru-RU')}\n`;
    
    if (submission.reviewed_at) {
      message += `📅 ${l.reviewDate}: ${new Date(submission.reviewed_at).toLocaleString(lang === 'ar' ? 'ar-SA' : lang === 'en' ? 'en-US' : 'ru-RU')}\n`;
    }
    
    if (submission.status === 'reject' && submission.reject_message) {
      message += `\n📝 ${l.rejectReason}:\n${submission.reject_message}`;
    }

    // إضافة زر التحسين إذا كان مرفوض مع إمكانية إعادة المحاولة
    const keyboard = [];
    if (submission.status === 'reject' && submission.can_retry === 1) {
      // التحقق من انتهاء المهلة
      const isExpired = await Submission.checkImprovementExpired(submission.id);
      
      if (isExpired) {
        // انتهت المهلة - إلغاء إمكانية التحسين
        await Submission.disableRetry(submission.id);
        
        const expiredTexts = {
          ar: '\n\n⏰ انتهت مهلة التحسين',
          en: '\n\n⏰ Improvement deadline expired',
          ru: '\n\n⏰ Срок улучшения истек'
        };
        message += expiredTexts[lang];
      } else {
        // حساب الوقت المتبقي
        const submissionDetails = await Submission.getById(submission.id);
        if (submissionDetails.improvement_deadline) {
          const deadline = new Date(submissionDetails.improvement_deadline);
          const now = new Date();
          const remainingMs = deadline - now;
          const remainingMinutes = Math.floor(remainingMs / 60000);
          
          if (remainingMinutes > 0) {
            const timeTexts = {
              ar: `\n\n⏰ الوقت المتبقي للتحسين: ${remainingMinutes} دقيقة`,
              en: `\n\n⏰ Time remaining for improvement: ${remainingMinutes} minutes`,
              ru: `\n\n⏰ Осталось времени для улучшения: ${remainingMinutes} минут`
            };
            message += timeTexts[lang];
          }
        }
        
        const improveTexts = {
          ar: '🔄 تحسين الإثبات',
          en: '🔄 Improve Submission',
          ru: '🔄 Улучшить заявку'
        };
        const declineTexts = {
          ar: '❌ رفض التحسين',
          en: '❌ Decline Improvement',
          ru: '❌ Отказаться от улучшения'
        };
        
        keyboard.push([
          { text: improveTexts[lang], callback_data: `improve_submission_${submission.id}` }
        ]);
        keyboard.push([
          { text: declineTexts[lang], callback_data: `decline_improvement_${submission.id}` }
        ]);
      }
    }

    await bot.sendMessage(chatId, message, keyboard.length > 0 ? {
      reply_markup: {
        inline_keyboard: keyboard
      }
    } : {});
  }
});

// معالج المساعدة - يدعم جميع اللغات
bot.onText(/⚙️ المساعدة|⚙️ Help|⚙️ Помощь/, async (msg) => {
  if (msg.handled) return; // تم حظر المستخدم
  
  const user = await User.findByTelegramId(msg.from.id);
  const lang = user?.language || 'ar';
  
  logCommand('⚙️ Help', msg.from.id, msg.from.username);
  
  const helpMessages = {
    ar: `
📖 دليل الاستخدام:

1️⃣ المهام المتاحة:
عرض جميع المهام التي يمكنك تنفيذها

2️⃣ إضافة مهمة:
• مهمة مدفوعة: تدفع للمستخدمين مقابل الإحالات
• تبادل إحالات: تنفذ مهام الآخرين لتحصل على إحالات

3️⃣ تنفيذ المهام:
• اختر مهمة من القائمة
• افتح رابط الإحالة
• نفذ التعليمات
• أرسل الإثبات

4️⃣ أنواع الإثبات:
• نص فقط
• صور فقط (حد أقصى 3)
• نص + صور

5️⃣ المراجعة:
• يتم مراجعة الإثبات من الإدارة
• عند القبول تحصل على المكافأة

💡 ملاحظات:
• لا يمكن تنفيذ نفس المهمة مرتين
• الصور محدودة بـ 3 صور فقط
• تبادل الإحالات يتطلب تنفيذ مهام أولاً
  `,
    en: `
📖 User Guide:

1️⃣ Available Tasks:
View all tasks you can complete

2️⃣ Add Task:
• Paid task: Pay users for referrals
• Referral exchange: Complete others' tasks to get referrals

3️⃣ Complete Tasks:
• Choose a task from the list
• Open the referral link
• Follow the instructions
• Send proof

4️⃣ Proof Types:
• Text only
• Images only (max 3)
• Text + images

5️⃣ Review:
• Proof is reviewed by administration
• Get rewarded upon approval

💡 Notes:
• Cannot complete the same task twice
• Images limited to 3 only
• Referral exchange requires completing tasks first
  `,
    ru: `
📖 Руководство пользователя:

1️⃣ Доступные задачи:
Просмотр всех задач, которые вы можете выполнить

2️⃣ Добавить задачу:
• Платная задача: Платите пользователям за рефералов
• Обмен рефералами: Выполняйте задачи других, чтобы получить рефералов

3️⃣ Выполнение задач:
• Выберите задачу из списка
• Откройте реферальную ссылку
• Следуйте инструкциям
• Отправьте доказательство

4️⃣ Типы доказательств:
• Только текст
• Только изображения (макс. 3)
• Текст + изображения

5️⃣ Проверка:
• Доказательство проверяется администрацией
• Получите вознаграждение после одобрения

💡 Примечания:
• Нельзя выполнить одну и ту же задачу дважды
• Изображения ограничены 3 штуками
• Обмен рефералами требует сначала выполнения задач
  `
  };

  await bot.sendMessage(msg.chat.id, helpMessages[lang]);
});

// معالج الدعم - يدعم جميع اللغات
bot.onText(/💬 الدعم|💬 Support|💬 Поддержка/, async (msg) => {
  if (msg.handled) return; // تم حظر المستخدم
  
  const user = await User.findByTelegramId(msg.from.id);
  const lang = user?.language || 'ar';
  
  logCommand('💬 Support', msg.from.id, msg.from.username);
  
  const supportText = await Settings.getSupportText(lang);
  const headers = {
    ar: '💬 الدعم\n\n',
    en: '💬 Support\n\n',
    ru: '💬 Поддержка\n\n'
  };
  
  await bot.sendMessage(msg.chat.id, headers[lang] + supportText);
});

// معالج اللغة - يدعم جميع اللغات
bot.onText(/🌐 اللغة|🌐 Language|🌐 Язык/, async (msg) => {
  if (msg.handled) return; // تم حظر المستخدم
  
  logCommand('🌐 Language', msg.from.id, msg.from.username);
  await bot.sendMessage(
    msg.chat.id,
    '🌐 اختر اللغة / Choose Language / Выберите язык:',
    userLanguageKeyboard
  );
});

// معالج التقييمات - يدعم جميع اللغات
bot.onText(/⭐ تقييماتي|⭐ My Ratings|⭐ Мои рейтинги/, (msg) => {
  if (msg.handled) return; // تم حظر المستخدم
  handleViewRatings(bot, msg);
});

// معالج الاستئناف - يدعم جميع اللغات (يُسمح للمحظورين)
bot.onText(/📝 استئناف|📝 Appeal|📝 Апелляция/, (msg) => {
  // لا نفحص msg.handled هنا لأن المحظورين يحتاجون للاستئناف
  handleStartAppeal(bot, msg);
});

// معالج الإحصائيات (للأدمن فقط)
bot.onText(/📊 الإحصائيات/, (msg) => {
  handleStatistics(bot, msg);
});

// معالج الرسالة الجماعية (للأدمن فقط)
bot.onText(/📢 رسالة جماعية/, (msg) => {
  handleStartBroadcast(bot, msg);
});

// معالج الاستئنافات (للأدمن فقط)
bot.onText(/📋 الاستئنافات/, (msg) => {
  handleViewAppeals(bot, msg);
});

// معالج عرض المهام المتاحة - يدعم جميع اللغات
bot.onText(/📋 المهام المتاحة|📋 Available Tasks|📋 Доступные задачи/, (msg) => {
  if (msg.handled) return; // تم حظر المستخدم
  logCommand('📋 View Tasks', msg.from.id, msg.from.username);
  handleViewTasks(bot, msg);
});

// معالج إضافة مهمة - يدعم جميع اللغات
bot.onText(/➕ إضافة مهمة|➕ Add Task|➕ Добавить задачу/, (msg) => {
  if (msg.handled) return; // تم حظر المستخدم
  logCommand('➕ Add Task', msg.from.id, msg.from.username);
  handleAddTask(bot, msg);
});

// معالج الإيداع - يدعم جميع اللغات
bot.onText(/💳 إيداع USDT|💳 Deposit USDT|💳 Пополнить USDT/, (msg) => {
  if (msg.handled) return; // تم حظر المستخدم
  logCommand('💳 Deposit', msg.from.id, msg.from.username);
  handleStartDeposit(bot, msg);
});

// معالج السحب - يدعم جميع اللغات
bot.onText(/💸 سحب USDT|💸 Withdraw USDT|💸 Вывод USDT/, (msg) => {
  if (msg.handled) return; // تم حظر المستخدم
  logCommand('💸 Withdraw', msg.from.id, msg.from.username);
  handleStartWithdrawal(bot, msg);
});

// حذف معالجات الأدمن القديمة - تم نقلها للوحة التحكم

// معالج تفاصيل المهمة
bot.onText(/\/task_(\d+)/, (msg, match) => {
  const taskId = parseInt(match[1]);
  handleTaskDetails(bot, msg, taskId);
});

// معالج بدء تقديم الإثبات
bot.onText(/\/submit_(\d+)/, (msg, match) => {
  const taskId = parseInt(match[1]);
  handleStartSubmission(bot, msg, taskId);
});

// معالج مراجعة المهام (للمسؤولين فقط) - يدعم جميع اللغات
bot.onText(/✅ مراجعة المهام|✅ Review Tasks|✅ Проверить задачи/, async (msg) => {
  logCommand('✅ Review Tasks', msg.from.id, msg.from.username);
  
  const isAdmin = await Admin.isAdmin(msg.from.id);
  if (!isAdmin) {
    const user = await User.findByTelegramId(msg.from.id);
    const lang = user?.language || 'ar';
    const messages = {
      ar: '❌ غير مصرح لك بهذا الأمر',
      en: '❌ You are not authorized',
      ru: '❌ У вас нет доступа'
    };
    await bot.sendMessage(msg.chat.id, messages[lang]);
    return;
  }

  const submissions = await Submission.getPending();

  if (submissions.length === 0) {
    await bot.sendMessage(msg.chat.id, '✅ لا توجد مهام قيد المراجعة');
    return;
  }

  await bot.sendMessage(msg.chat.id, `📋 عدد المهام قيد المراجعة: ${submissions.length}`);
});

// معالج لوحة التحكم (للأدمن فقط) - يدعم جميع اللغات
bot.onText(/⚙️ لوحة التحكم|⚙️ Admin Panel|⚙️ Панель управления/, async (msg) => {
  const chatId = msg.chat.id;
  
  logCommand('⚙️ Admin Panel', msg.from.id, msg.from.username);
  
  const isAdmin = await Admin.isAdmin(msg.from.id);
  if (!isAdmin) {
    const user = await User.findByTelegramId(msg.from.id);
    const lang = user?.language || 'ar';
    const messages = {
      ar: '❌ غير مصرح لك بهذا الأمر',
      en: '❌ You are not authorized',
      ru: '❌ У вас нет доступа'
    };
    await bot.sendMessage(chatId, messages[lang]);
    return;
  }

  await bot.sendMessage(
    chatId,
    '⚙️ لوحة تحكم الأدمن\n\nاختر الإجراء المطلوب:',
    Admin.isMainAdmin(msg.from.id) ? mainAdminPanelKeyboard : adminPanelKeyboard
  );
});

// معالج إدارة الأدمنز (للأدمن الرئيسي فقط)
bot.onText(/👥 إدارة الأدمنز/, async (msg) => {
  logCommand('👥 Manage Admins', msg.from.id, msg.from.username);
  await handleManageAdmins(bot, msg);
});

// معالج مراجعة الإيداعات (للأدمن فقط)
bot.onText(/💵 مراجعة الإيداعات/, async (msg) => {
  logCommand('💵 Review Deposits', msg.from.id, msg.from.username);
  
  const isAdmin = await Admin.isAdmin(msg.from.id);
  if (!isAdmin) {
    await bot.sendMessage(msg.chat.id, '❌ غير مصرح لك بهذا الأمر');
    return;
  }

  const deposits = await Deposit.getPending();
  
  if (deposits.length === 0) {
    await bot.sendMessage(msg.chat.id, '✅ لا توجد إيداعات للمراجعة');
    return;
  }

  await bot.sendMessage(msg.chat.id, `💵 عدد الإيداعات المعلقة: ${deposits.length}`);
  
  // إرسال تفاصيل كل إيداع
  for (const deposit of deposits) {
    let message = `🆔 رقم الطلب: ${deposit.id}\n`;
    message += `👤 المستخدم: @${deposit.username || 'غير متوفر'}\n`;
    message += `💰 المبلغ: ${deposit.amount} USDT\n`;
    message += `📍 الطريقة: ${deposit.method === 'binance_id' ? 'Binance ID' : 'عنوان المحفظة'}\n\n`;
    
    if (deposit.method === 'binance_id') {
      message += `🆔 Binance ID: ${deposit.binance_id}\n`;
      message += `⏰ وقت التحويل: ${deposit.transfer_time}\n`;
    } else {
      message += `🔗 TXID: ${deposit.txid}\n`;
    }

    await bot.sendMessage(msg.chat.id, message, depositReviewKeyboard(deposit.id));
    
    if (deposit.screenshot_id) {
      await bot.sendPhoto(msg.chat.id, deposit.screenshot_id, {
        caption: '📸 صورة التحويل'
      });
    }
  }
});

// معالج مراجعة السحوبات (للأدمن فقط)
bot.onText(/💸 مراجعة السحوبات/, async (msg) => {
  logCommand('💸 Review Withdrawals', msg.from.id, msg.from.username);
  
  const isAdmin = await Admin.isAdmin(msg.from.id);
  if (!isAdmin) {
    await bot.sendMessage(msg.chat.id, '❌ غير مصرح لك بهذا الأمر');
    return;
  }

  const Withdrawal = (await import('./models/Withdrawal.js')).default;
  const withdrawals = await Withdrawal.getPending();
  
  if (withdrawals.length === 0) {
    await bot.sendMessage(msg.chat.id, '✅ لا توجد سحوبات للمراجعة');
    return;
  }

  await bot.sendMessage(msg.chat.id, `💸 عدد السحوبات المعلقة: ${withdrawals.length}`);
  
  // إرسال تفاصيل كل سحب
  for (const withdrawal of withdrawals) {
    let message = `🆔 رقم الطلب: ${withdrawal.id}\n`;
    message += `👤 المستخدم: @${withdrawal.username || 'غير متوفر'}\n`;
    message += `💰 المبلغ: ${withdrawal.amount} USDT\n`;
    message += `📍 الطريقة: ${withdrawal.method === 'binance_id' ? 'Binance Pay ID' : 'عنوان المحفظة'}\n\n`;
    
    if (withdrawal.method === 'binance_id') {
      message += `🆔 Binance Pay ID: ${withdrawal.binance_id}\n`;
    } else {
      message += `📍 العنوان: ${withdrawal.wallet_address}\n`;
      message += `🌐 الشبكة: ${withdrawal.network}\n`;
    }

    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ تم الإرسال', callback_data: `withdrawal_complete_${withdrawal.id}` },
            { text: '❌ رفض', callback_data: `withdrawal_reject_${withdrawal.id}` }
          ]
        ]
      }
    };

    await bot.sendMessage(msg.chat.id, message, keyboard);
    
    if (withdrawal.screenshot_id) {
      await bot.sendPhoto(msg.chat.id, withdrawal.screenshot_id, {
        caption: '📸 صورة Binance Pay ID'
      });
    }
  }
});

// معالج البحث عن مستخدم (للأدمن فقط)
bot.onText(/🔍 البحث عن مستخدم/, (msg) => {
  logCommand('🔍 Search User', msg.from.id, msg.from.username);
  handleSearchUser(bot, msg);
});

// معالج تعديل نص الدعم (للأدمن فقط)
bot.onText(/✏️ تعديل نص الدعم/, (msg) => {
  logCommand('✏️ Edit Support', msg.from.id, msg.from.username);
  handleEditSupportText(bot, msg);
});

// معالج تغيير الحد الأقصى للأشخاص (للأدمن فقط)
bot.onText(/🔧 تغيير الحد الأقصى للأشخاص/, async (msg) => {
  logCommand('🔧 Change Max Count', msg.from.id, msg.from.username);
  
  const isAdmin = await Admin.isAdmin(msg.from.id);
  if (!isAdmin) {
    await bot.sendMessage(msg.chat.id, '❌ غير مصرح لك بهذا الأمر');
    return;
  }

  const currentMax = await Settings.getMaxRequiredCount();
  
  adminStatesFromHandler.set(msg.chat.id, { step: 'awaiting_max_count' });
  
  await bot.sendMessage(
    msg.chat.id,
    `🔧 تغيير الحد الأقصى للأشخاص المطلوبين\n\n` +
    `الحد الحالي: ${currentMax}\n\n` +
    `أرسل الحد الأقصى الجديد:`,
    {
      reply_markup: {
        keyboard: [['❌ إلغاء']],
        resize_keyboard: true
      }
    }
  );
});

// معالج تغيير حد المهام للمستخدم (للأدمن فقط)
bot.onText(/📝 تغيير حد المهام للمستخدم/, async (msg) => {
  logCommand('📝 Change Max Tasks', msg.from.id, msg.from.username);
  
  const isAdmin = await Admin.isAdmin(msg.from.id);
  if (!isAdmin) {
    await bot.sendMessage(msg.chat.id, '❌ غير مصرح لك بهذا الأمر');
    return;
  }

  const currentMax = await Settings.getMaxTasksPerUser();
  
  adminStatesFromHandler.set(msg.chat.id, { step: 'awaiting_max_tasks' });
  
  await bot.sendMessage(
    msg.chat.id,
    `📝 تغيير حد المهام للمستخدم\n\n` +
    `الحد الحالي: ${currentMax}\n\n` +
    `أرسل الحد الأقصى الجديد:`,
    {
      reply_markup: {
        keyboard: [['❌ إلغاء']],
        resize_keyboard: true
      }
    }
  );
});

// معالج تغيير وقت المهلة (للأدمن فقط)
bot.onText(/⏱️ تغيير وقت المهلة/, async (msg) => {
  logCommand('⏱️ Change Task Timeout', msg.from.id, msg.from.username);
  
  const isAdmin = await Admin.isAdmin(msg.from.id);
  if (!isAdmin) {
    await bot.sendMessage(msg.chat.id, '❌ غير مصرح لك بهذا الأمر');
    return;
  }

  const currentTimeout = await Settings.getTaskTimeout();
  const currentMinutes = Math.floor(currentTimeout / 60);
  
  adminStatesFromHandler.set(msg.chat.id, { step: 'awaiting_task_timeout' });
  
  await bot.sendMessage(
    msg.chat.id,
    `⏱️ تغيير وقت المهلة للمهام\n\n` +
    `⏰ الوقت الحالي: ${currentMinutes} دقيقة\n\n` +
    `📝 أرسل الوقت الجديد بالدقائق:`,
    {
      reply_markup: {
        keyboard: [['❌ إلغاء']],
        resize_keyboard: true
      }
    }
  );
});

// معالج تغيير مهلة التحسين (للأدمن فقط)
bot.onText(/🔄 تغيير مهلة التحسين/, async (msg) => {
  logCommand('🔄 Change Improvement Timeout', msg.from.id, msg.from.username);
  
  const isAdmin = await Admin.isAdmin(msg.from.id);
  if (!isAdmin) {
    await bot.sendMessage(msg.chat.id, '❌ غير مصرح لك بهذا الأمر');
    return;
  }

  const currentTimeout = await Settings.getImprovementTimeout();
  const currentMinutes = Math.floor(currentTimeout / 60);
  
  adminStatesFromHandler.set(msg.chat.id, { step: 'awaiting_improvement_timeout' });
  
  await bot.sendMessage(
    msg.chat.id,
    `🔄 تغيير مهلة التحسين للإثباتات المرفوضة\n\n` +
    `⏰ المهلة الحالية: ${currentMinutes} دقيقة\n\n` +
    `📝 أرسل المهلة الجديدة بالدقائق:`,
    {
      reply_markup: {
        keyboard: [['❌ إلغاء']],
        resize_keyboard: true
      }
    }
  );
});

// معالج تغيير الحد الأدنى للمكافأة (للأدمن فقط)
bot.onText(/💰 تغيير الحد الأدنى للمكافأة/, async (msg) => {
  logCommand('💰 Change Min Reward', msg.from.id, msg.from.username);
  
  const isAdmin = await Admin.isAdmin(msg.from.id);
  if (!isAdmin) {
    await bot.sendMessage(msg.chat.id, '❌ غير مصرح لك بهذا الأمر');
    return;
  }

  const currentMinReward = await Settings.getMinReward();
  
  adminStatesFromHandler.set(msg.chat.id, { step: 'awaiting_min_reward' });
  
  await bot.sendMessage(
    msg.chat.id,
    `💰 تغيير الحد الأدنى للمكافأة\n\n` +
    `💵 الحد الأدنى الحالي: ${currentMinReward} USDT\n\n` +
    `📝 أرسل الحد الأدنى الجديد (بالـ USDT):`,
    {
      reply_markup: {
        keyboard: [['❌ إلغاء']],
        resize_keyboard: true
      }
    }
  );
});

// معالج تغيير الحد الأدنى للسحب (للأدمن فقط)
bot.onText(/💸 تغيير الحد الأدنى للسحب/, async (msg) => {
  logCommand('💸 Change Min Withdrawal', msg.from.id, msg.from.username);
  
  const isAdmin = await Admin.isAdmin(msg.from.id);
  if (!isAdmin) {
    await bot.sendMessage(msg.chat.id, '❌ غير مصرح لك بهذا الأمر');
    return;
  }

  const currentMinWithdrawal = await Settings.getMinWithdrawal();
  
  adminStatesFromHandler.set(msg.chat.id, { step: 'awaiting_min_withdrawal' });
  
  await bot.sendMessage(
    msg.chat.id,
    `💸 تغيير الحد الأدنى للسحب\n\n` +
    `💵 الحد الأدنى الحالي: ${currentMinWithdrawal} USDT\n\n` +
    `📝 أرسل الحد الأدنى الجديد (بالـ USDT):`,
    {
      reply_markup: {
        keyboard: [['❌ إلغاء']],
        resize_keyboard: true
      }
    }
  );
});

// معالج زر الرجوع من لوحة التحكم
bot.onText(/🔙 رجوع/, async (msg) => {
  logCommand('🔙 Back', msg.from.id, msg.from.username);
  
  const user = await User.findByTelegramId(msg.from.id);
  const lang = user?.language || 'ar';
  const isAdmin = await Admin.isAdmin(msg.from.id);
  
  const messages = {
    ar: 'القائمة الرئيسية',
    en: '📋 Main Menu',
    ru: '📋 Главное меню'
  };
  
  await bot.sendMessage(
    msg.chat.id,
    messages[lang],
    getMainMenuKeyboard(isAdmin, lang)
  );
});

// حذف معالجات الأدمن القديمة
// معالج تغيير الحد الأقصى - تم نقله للوحة التحكم
// معالج تغيير حد المهام - تم نقله للوحة التحكم
// معالج مراجعة الإيداعات - تم نقله للوحة التحكم
// معالج مراجعة المهام - تم نقله للوحة التحكم

// معالج الرسائل النصية
bot.on('message', async (msg) => {
  if (msg.handled) return; // تم حظر المستخدم
  if (msg.text && msg.text.startsWith('/')) return;
  
  // معالج زر الإلغاء - يعمل حتى بعد إعادة تشغيل البوت
  if (msg.text === '❌ إلغاء') {
    const chatId = msg.chat.id;
    const isAdmin = await Admin.isAdmin(msg.from.id);
    const user = await User.findByTelegramId(msg.from.id);
    const lang = user?.language || 'ar';
    
    const messages = {
      ar: '❌ تم إلغاء العملية',
      en: '❌ Operation cancelled',
      ru: '❌ Операция отменена'
    };
    
    await bot.sendMessage(
      chatId,
      messages[lang],
      getMainMenuKeyboard(isAdmin, lang)
    );
    
    logInfo('CANCEL', `User ${msg.from.id} cancelled operation`);
    return;
  }
  
  // تجاهل رسائل الأزرار التي تبدأ بـ emoji أو رموز خاصة
  // هذه الرسائل يتم معالجتها بواسطة معالجات onText المخصصة
  // ⚠️ لا تضع ✅ هنا لأنه يستخدم في زر "إرسال" في التقديمات
  const buttonPatterns = [
    /^📋/, /^➕/, /^💰/, /^📊/, /^💳/, /^⚙️/, 
    /^💬/, /^🆔/, /^🌐/, /^💵/, /^🔍/, /^✏️/, /^🔧/, 
    /^📝/, /^🔙/
  ];
  
  if (buttonPatterns.some(pattern => pattern.test(msg.text))) {
    return; // دع معالجات onText تتعامل مع هذه الرسائل
  }
  
  const handled = await handleTaskCreationSteps(bot, msg) || 
                  await handleSubmissionSteps(bot, msg) ||
                  await handleDepositSteps(bot, msg) ||
                  await handleDepositRejectReason(bot, msg) ||
                  await handleWithdrawalSteps(bot, msg) ||
                  await handleWithdrawalRejectReason(bot, msg) ||
                  await handleRejectMessage(bot, msg) ||
                  await handleAdminSteps(bot, msg) ||
                  await handleRatingComment(bot, msg) ||
                  await handleBroadcastMessage(bot, msg) ||
                  await handleAppealReason(bot, msg) ||
                  await handleAppealRejectNote(bot, msg);
});

// معالج الأزرار
bot.on('callback_query', async (query) => {
  // تجاهل الأدمن من فحص الحظر
  const isAdmin = await Admin.isAdmin(query.from.id);
  if (!isAdmin) {
    try {
      const user = await User.findByTelegramId(query.from.id);
      
      if (user) {
        // فحص حالة المستخدم (الحظر والتقييدات)
        const userStatus = await ViolationSystem.checkUserStatus(user.id);
        
        if (!userStatus.allowed) {
          const lang = user.language || 'ar';
          const banMessage = ViolationSystem.getBanMessage(
            userStatus.banStatus,
            userStatus.remaining,
            lang
          );
          
          if (banMessage) {
            await bot.answerCallbackQuery(query.id, { text: '🚫 محظور / Banned' });
            await bot.sendMessage(query.message.chat.id, banMessage);
            logWarning('CALLBACK', `Blocked banned user ${query.from.id} from using callback`);
            return; // إيقاف معالجة الزر
          }
        }
      }
    } catch (error) {
      logError('CALLBACK', 'Error checking user ban status', error);
    }
  }
  
  const data = query.data;
  logCallback(data, query.from.id, query.from.username);

  if (data === 'cancel') {
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText('❌ تم الإلغاء', {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id
    });
    logInfo('CALLBACK', 'User cancelled operation');
    return;
  }

  // معالجات إدارة الأدمنز
  if (data === 'admin_add_admin') {
    await bot.answerCallbackQuery(query.id);
    // إنشاء msg object مع from الصحيح
    const msg = {
      chat: query.message.chat,
      from: query.from,
      message_id: query.message.message_id
    };
    await handleAddAdmin(bot, msg);
    return;
  }

  if (data === 'admin_remove_admin') {
    await bot.answerCallbackQuery(query.id);
    // إنشاء msg object مع from الصحيح
    const msg = {
      chat: query.message.chat,
      from: query.from,
      message_id: query.message.message_id
    };
    await handleRemoveAdmin(bot, msg);
    return;
  }

  if (data === 'admin_list_admins') {
    await bot.answerCallbackQuery(query.id);
    // إنشاء msg object مع from الصحيح
    const msg = {
      chat: query.message.chat,
      from: query.from,
      message_id: query.message.message_id
    };
    await handleManageAdmins(bot, msg);
    return;
  }

  if (data === 'back_to_admin_panel') {
    await bot.answerCallbackQuery(query.id);
    
    // استخدام keyboard المناسب حسب نوع الأدمن
    const keyboard = Admin.isMainAdmin(query.from.id) ? mainAdminPanelKeyboard : adminPanelKeyboard;
    
    await bot.editMessageText(
      '⚙️ لوحة تحكم الأدمن\n\nاختر الإجراء المطلوب:',
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        ...keyboard
      }
    );
    return;
  }

  if (data.startsWith('task_type_')) {
    await handleTaskType(bot, query);
    await bot.answerCallbackQuery(query.id);
    return;
  }

  if (data.startsWith('proof_')) {
    await handleProofType(bot, query);
    await bot.answerCallbackQuery(query.id);
    return;
  }

  if (data === 'confirm_create_task' || data === 'cancel_create_task') {
    const { handleTaskConfirmation } = await import('./handlers/taskHandler.js');
    await handleTaskConfirmation(bot, query);
    return;
  }

  if (data.startsWith('admin_')) {
    // معالج تعديل الرصيد
    if (data.startsWith('admin_edit_balance_')) {
      const userId = parseInt(data.split('_')[3]);
      const user = await User.findByTelegramId(userId);
      
      if (!user) {
        await bot.answerCallbackQuery(query.id, { text: '❌ المستخدم غير موجود' });
        return;
      }
      
      adminStatesFromHandler.set(query.message.chat.id, { step: 'awaiting_new_balance', userId: user.id });
      
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(
        query.message.chat.id,
        `💰 تعديل محفظة المستخدم\n\n` +
        `👤 المستخدم: ${user.username ? '@' + user.username : user.telegram_id}\n` +
        `💰 المحفظة الحالية: ${user.balance} USDT\n\n` +
        `أرسل الرصيد الجديد:`,
        {
          reply_markup: {
            keyboard: [['❌ إلغاء']],
            resize_keyboard: true
          }
        }
      );
      return;
    }
    
    // معالج الحظر
    if (data.startsWith('admin_ban_')) {
      const userId = parseInt(data.split('_')[2]);
      
      // حماية الأدمن الرئيسي من الحظر
      if (Admin.isMainAdmin(userId)) {
        await bot.answerCallbackQuery(query.id, { 
          text: '❌ لا يمكن حظر الأدمن الرئيسي', 
          show_alert: true 
        });
        return;
      }
      
      const user = await User.findByTelegramId(userId);
      
      if (!user) {
        await bot.answerCallbackQuery(query.id, { text: '❌ المستخدم غير موجود' });
        return;
      }
      
      await User.banUser(user.id);
      await bot.answerCallbackQuery(query.id, { text: '✅ تم حظر المستخدم' });
      
      // تحديث الرسالة
      let message = '👤 معلومات المستخدم:\n\n';
      message += `🆔 ID: ${user.telegram_id}\n`;
      message += `👤 اليوزرنيم: ${user.username ? '@' + user.username : 'غير متوفر'}\n`;
      message += `💰 المحفظة: ${user.balance} USDT\n`;
      message += `🌐 اللغة: ${user.language}\n`;
      message += `🔴 محظور\n`;
      message += `📅 تاريخ التسجيل: ${new Date(user.created_at).toLocaleDateString('ar')}`;

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💰 تعديل المحفظة', callback_data: `admin_edit_balance_${user.telegram_id}` },
              { text: '✅ إلغاء الحظر', callback_data: `admin_unban_${user.telegram_id}` }
            ]
          ]
        }
      };

      await bot.editMessageText(message, {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        ...keyboard
      });
      return;
    }
    
    // معالج إلغاء الحظر
    if (data.startsWith('admin_unban_')) {
      const userId = parseInt(data.split('_')[2]);
      const user = await User.findByTelegramId(userId);
      
      if (!user) {
        await bot.answerCallbackQuery(query.id, { text: '❌ المستخدم غير موجود' });
        return;
      }
      
      await User.unbanUser(user.id);
      await bot.answerCallbackQuery(query.id, { text: '✅ تم إلغاء حظر المستخدم' });
      
      // تحديث الرسالة
      let message = '👤 معلومات المستخدم:\n\n';
      message += `🆔 ID: \`${user.telegram_id}\`\n`;
      message += `👤 اليوزرنيم: ${user.username ? '@' + user.username : 'غير متوفر'}\n`;
      message += `💰 المحفظة: ${user.balance} USDT\n`;
      message += `🌐 اللغة: ${user.language}\n`;
      message += `🟢 نشط\n`;
      message += `📅 تاريخ التسجيل: ${new Date(user.created_at).toLocaleDateString('ar')}`;

      const keyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💰 تعديل المحفظة', callback_data: `admin_edit_balance_${user.telegram_id}` },
              { text: '🚫 حظر', callback_data: `admin_ban_${user.telegram_id}` }
            ]
          ]
        }
      };

      await bot.editMessageText(message, {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        ...keyboard,
        parse_mode: 'Markdown'
      });
      return;
    }
    
    if (data === 'admin_review_tasks') {
      await bot.answerCallbackQuery(query.id);
      const submissions = await Submission.getPending();
      if (submissions.length === 0) {
        await bot.editMessageText(
          '✅ لا توجد مهام قيد المراجعة',
          { chat_id: query.message.chat.id, message_id: query.message.message_id }
        );
      } else {
        await bot.editMessageText(
          `📋 عدد المهام قيد المراجعة: ${submissions.length}`,
          { chat_id: query.message.chat.id, message_id: query.message.message_id }
        );
      }
      return;
    }
    
    if (data === 'admin_review_deposits') {
      await bot.answerCallbackQuery(query.id);
      const deposits = await Deposit.getPending();
      if (deposits.length === 0) {
        await bot.editMessageText(
          '✅ لا توجد طلبات إيداع قيد المراجعة',
          { chat_id: query.message.chat.id, message_id: query.message.message_id }
        );
      } else {
        await bot.editMessageText(
          `📋 عدد طلبات الإيداع قيد المراجعة: ${deposits.length}`,
          { chat_id: query.message.chat.id, message_id: query.message.message_id }
        );
      }
      return;
    }
    
    if (data === 'admin_search_user') {
      await bot.answerCallbackQuery(query.id);
      await bot.editMessageText(
        query.message.text,
        { chat_id: query.message.chat.id, message_id: query.message.message_id }
      );
      await handleSearchUser(bot, query.message);
      return;
    }
    
    if (data === 'admin_edit_support') {
      await bot.answerCallbackQuery(query.id);
      await handleEditSupportText(bot, query.message);
      return;
    }
    
    if (data === 'admin_change_max') {
      await bot.answerCallbackQuery(query.id);
      const currentMax = await Settings.getMaxRequiredCount();
      adminStatesFromHandler.set(query.message.chat.id, { step: 'awaiting_max_count' });
      
      await bot.editMessageText(
        `🔧 تغيير الحد الأقصى للأشخاص المطلوبين\n\n📊 الحد الحالي: ${currentMax} أشخاص\n\n🔢 أرسل الحد الأقصى الجديد:`,
        { chat_id: query.message.chat.id, message_id: query.message.message_id }
      );
      return;
    }
    
    if (data === 'admin_max_tasks') {
      await bot.answerCallbackQuery(query.id);
      const currentMax = await Settings.getMaxTasksPerUser();
      adminStatesFromHandler.set(query.message.chat.id, { step: 'awaiting_max_tasks' });
      
      await bot.editMessageText(
        `📝 تغيير الحد الأقصى للمهام النشطة لكل مستخدم\n\n📊 الحد الحالي: ${currentMax} مهمة\n\n🔢 أرسل الحد الأقصى الجديد:`,
        { chat_id: query.message.chat.id, message_id: query.message.message_id }
      );
      return;
    }
  }

  if (data.startsWith('set_lang_')) {
    logInfo('LANGUAGE', `User ${query.from.id} changing language to ${data.split('_')[2]}`);
    await handleLanguageSelection(bot, query);
    return;
  }

  if (data.startsWith('support_lang_')) {
    logInfo('ADMIN', `Admin ${query.from.id} editing support text for ${data.split('_')[2]}`);
    await handleLanguageSelection(bot, query);
    return;
  }

  if (data.startsWith('review_') || data.startsWith('reject_')) {
    logInfo('REVIEW', `Admin ${query.from.id} reviewing submission`);
    await handleReview(bot, query);
    return;
  }

  if (data.startsWith('report_')) {
    logInfo('REPORT', `User ${query.from.id} reporting user`);
    await handleReport(bot, query);
    return;
  }

  // معالج تحسين الإثبات
  if (data.startsWith('improve_submission_')) {
    const submissionId = parseInt(data.split('_')[2]);
    const user = await User.findByTelegramId(query.from.id);
    
    if (!user) {
      await bot.answerCallbackQuery(query.id, { text: '❌' });
      return;
    }

    const lang = user.language || 'ar';
    const submission = await Submission.getById(submissionId);
    
    if (!submission) {
      const messages = {
        ar: '❌ الإثبات غير موجود',
        en: '❌ Submission not found',
        ru: '❌ Заявка не найдена'
      };
      await bot.answerCallbackQuery(query.id, { text: messages[lang] });
      return;
    }

    // التحقق من أن المستخدم هو صاحب الإثبات
    if (submission.user_id !== user.id) {
      const messages = {
        ar: '❌ غير مصرح لك',
        en: '❌ Not authorized',
        ru: '❌ Не авторизован'
      };
      await bot.answerCallbackQuery(query.id, { text: messages[lang] });
      return;
    }

    // التحقق من إمكانية التحسين
    if (submission.can_retry !== 1) {
      const messages = {
        ar: '❌ لا يمكن تحسين هذا الإثبات',
        en: '❌ Cannot improve this submission',
        ru: '❌ Невозможно улучшить эту заявку'
      };
      await bot.answerCallbackQuery(query.id, { text: messages[lang] });
      return;
    }

    // التحقق من انتهاء المهلة
    const isExpired = await Submission.checkImprovementExpired(submissionId);
    if (isExpired) {
      await Submission.disableRetry(submissionId);
      const messages = {
        ar: '⏰ انتهت مهلة التحسين',
        en: '⏰ Improvement deadline expired',
        ru: '⏰ Срок улучшения истек'
      };
      await bot.answerCallbackQuery(query.id, { text: messages[lang] });
      return;
    }

    await bot.answerCallbackQuery(query.id);

    // حذف الإثبات القديم وإلغاء إمكانية إعادة المحاولة
    await Submission.disableRetry(submissionId);
    
    const messages = {
      ar: '🔄 سيتم الآن بدء عملية تقديم إثبات جديد محسّن\n\nتأكد من تحسين الإثبات حسب الملاحظات المذكورة',
      en: '🔄 Starting improved submission process\n\nMake sure to improve the proof according to the feedback',
      ru: '🔄 Начинается процесс улучшенной заявки\n\nУбедитесь, что улучшили доказательство согласно отзывам'
    };
    
    await bot.sendMessage(query.message.chat.id, messages[lang]);

    // بدء عملية تقديم جديدة لنفس المهمة
    const fakeMsg = {
      chat: query.message.chat,
      from: query.from
    };
    
    await handleStartSubmission(bot, fakeMsg, submission.task_id);
    return;
  }

  // معالج رفض التحسين
  if (data.startsWith('decline_improvement_')) {
    const submissionId = parseInt(data.split('_')[2]);
    const user = await User.findByTelegramId(query.from.id);
    
    if (!user) {
      await bot.answerCallbackQuery(query.id, { text: '❌' });
      return;
    }

    const lang = user.language || 'ar';
    const submission = await Submission.getById(submissionId);
    
    if (!submission) {
      const messages = {
        ar: '❌ الإثبات غير موجود',
        en: '❌ Submission not found',
        ru: '❌ Заявка не найдена'
      };
      await bot.answerCallbackQuery(query.id, { text: messages[lang] });
      return;
    }

    // التحقق من أن المستخدم هو صاحب الإثبات
    if (submission.user_id !== user.id) {
      const messages = {
        ar: '❌ غير مصرح لك',
        en: '❌ Not authorized',
        ru: '❌ Не авторизован'
      };
      await bot.answerCallbackQuery(query.id, { text: messages[lang] });
      return;
    }

    // إلغاء إمكانية إعادة المحاولة
    await Submission.disableRetry(submissionId);
    
    const messages = {
      ar: '❌ تم رفض التحسين\n\nلن تتمكن من تحسين هذا الإثبات مرة أخرى وتم خسارة المكافأة',
      en: '❌ Improvement declined\n\nYou cannot improve this submission again and the reward is lost',
      ru: '❌ Улучшение отклонено\n\nВы не можете улучшить эту заявку снова, и награда потеряна'
    };
    
    await bot.answerCallbackQuery(query.id, { text: '✅' });
    await bot.sendMessage(query.message.chat.id, messages[lang]);
    
    // تحديث الرسالة لإزالة الأزرار
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id
      }
    );
    return;
  }

  if (data.startsWith('deposit_')) {
    if (data.startsWith('deposit_accept_') || data.startsWith('deposit_reject_')) {
      await handleDepositReview(bot, query);
    } else if (data.startsWith('deposit_binance_id') || data.startsWith('deposit_wallet')) {
      await handleDepositMethod(bot, query);
      await bot.answerCallbackQuery(query.id);
    }
    return;
  }

  if (data.startsWith('withdrawal_')) {
    if (data.startsWith('withdrawal_complete_') || data.startsWith('withdrawal_reject_')) {
      await handleWithdrawalReview(bot, query);
    } else if (data.startsWith('withdrawal_binance_id') || data.startsWith('withdrawal_wallet')) {
      await handleWithdrawalMethod(bot, query);
      await bot.answerCallbackQuery(query.id);
    }
    return;
  }

  if (data.startsWith('execute_task_')) {
    const taskId = parseInt(data.split('_')[2]);
    await bot.answerCallbackQuery(query.id);
    // إنشاء كائن msg مشابه للرسالة العادية
    const fakeMsg = {
      chat: query.message.chat,
      from: query.from
    };
    await handleTaskDetails(bot, fakeMsg, taskId);
    return;
  }

  if (data.startsWith('start_submit_')) {
    const taskId = parseInt(data.split('_')[2]);
    logCallback(`start_submit_${taskId}`, query.from.id, query.from.username);
    
    await bot.answerCallbackQuery(query.id);
    
    // إنشاء كائن msg مشابه للرسالة العادية
    const fakeMsg = {
      chat: query.message.chat,
      from: query.from
    };
    
    logInfo('CALLBACK', `Starting submission for task ${taskId} by user ${query.from.id}`);
    
    try {
      await handleStartSubmission(bot, fakeMsg, taskId);
      logSuccess('CALLBACK', `Submission started successfully for task ${taskId}`);
    } catch (error) {
      logError('CALLBACK', `Error starting submission for task ${taskId}`, error);
      console.error('Error in start_submit:', error);
    }
    return;
  }

  if (data.startsWith('cancel_task_')) {
    const taskId = parseInt(data.split('_')[2]);
    const user = await User.findByTelegramId(query.from.id);
    const lang = user?.language || 'ar';
    
    const messages = {
      ar: '❌ تم إلغاء العملية',
      en: '❌ Operation cancelled',
      ru: '❌ Операция отменена'
    };
    
    await bot.answerCallbackQuery(query.id, { text: messages[lang] });
    await bot.deleteMessage(query.message.chat.id, query.message.message_id);
    return;
  }

  if (data.startsWith('pause_task_')) {
    const taskId = parseInt(data.split('_')[2]);
    const user = await User.findByTelegramId(query.from.id);
    const lang = user?.language || 'ar';
    
    if (!user) {
      const messages = {
        ar: '❌ خطأ في التحقق من المستخدم',
        en: '❌ User verification error',
        ru: '❌ Ошибка проверки пользователя'
      };
      await bot.answerCallbackQuery(query.id, { text: messages[lang] });
      return;
    }

    // التحقق من أن المستخدم هو صاحب المهمة
    const isOwner = await Task.isOwner(taskId, user.id);
    
    if (!isOwner) {
      const messages = {
        ar: '❌ غير مصرح لك بإيقاف هذه المهمة',
        en: '❌ You are not authorized to pause this task',
        ru: '❌ У вас нет прав приостановить эту задачу'
      };
      await bot.answerCallbackQuery(query.id, { text: messages[lang] });
      return;
    }

    // إيقاف المهمة
    await Task.updateStatus(taskId, 'stopped');
    
    const successMessages = {
      ar: '⏸️ تم إيقاف المهمة\n\nلن تظهر في قائمة المهام المتاحة حتى تنتهي جميع التقديمات المعلقة',
      en: '⏸️ Task paused\n\nIt will not appear in available tasks until all pending submissions are completed',
      ru: '⏸️ Задача приостановлена\n\nОна не будет отображаться в доступных задачах до завершения всех ожидающих заявок'
    };
    
    await bot.answerCallbackQuery(query.id, { text: '✅' });
    await bot.editMessageText(
      query.message.text.replace('🟢 نشط', '🔴 متوقف').replace('🟢 Active', '🔴 Stopped').replace('🟢 Активна', '🔴 Остановлена'),
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: lang === 'ar' ? '▶️ تفعيل' : lang === 'en' ? '▶️ Resume' : '▶️ Возобновить', callback_data: `resume_task_${taskId}` }]
          ]
        }
      }
    );
    
    await bot.sendMessage(query.message.chat.id, successMessages[lang]);
    return;
  }

  if (data.startsWith('task_submissions_')) {
    const taskId = parseInt(data.split('_')[2]);
    const user = await User.findByTelegramId(query.from.id);
    const lang = user?.language || 'ar';
    
    if (!user) {
      await bot.answerCallbackQuery(query.id, { text: '❌' });
      return;
    }

    // التحقق من أن المستخدم هو صاحب المهمة
    const isOwner = await Task.isOwner(taskId, user.id);
    
    if (!isOwner) {
      const messages = {
        ar: '❌ غير مصرح لك بعرض تقديمات هذه المهمة',
        en: '❌ You are not authorized to view submissions for this task',
        ru: '❌ У вас нет прав просматривать заявки для этой задачи'
      };
      await bot.answerCallbackQuery(query.id, { text: messages[lang] });
      return;
    }

    await bot.answerCallbackQuery(query.id);

    const submissions = await Submission.getTaskSubmissions(taskId);
    const task = await Task.getById(taskId);

    if (submissions.length === 0) {
      const messages = {
        ar: '❌ لا توجد تقديمات لهذه المهمة',
        en: '❌ No submissions for this task',
        ru: '❌ Нет заявок для этой задачи'
      };
      await bot.sendMessage(query.message.chat.id, messages[lang]);
      return;
    }

    const headers = {
      ar: `📝 تقديمات المهمة: ${task.bot_name}\n\n`,
      en: `📝 Submissions for: ${task.bot_name}\n\n`,
      ru: `📝 Заявки для: ${task.bot_name}\n\n`
    };
    
    await bot.sendMessage(query.message.chat.id, headers[lang]);
    
    // إرسال كل تقديم مع الإثبات وأزرار القبول/الرفض
    for (const submission of submissions) {
      const statusEmoji = {
        pending: '⏳',
        accept: '✅',
        reject: '❌'
      };
      
      const statusTexts = {
        ar: {
          pending: 'قيد المراجعة',
          accept: 'مقبول',
          reject: 'مرفوض'
        },
        en: {
          pending: 'Under Review',
          accept: 'Accepted',
          reject: 'Rejected'
        },
        ru: {
          pending: 'На рассмотрении',
          accept: 'Принято',
          reject: 'Отклонено'
        }
      };
      
      let message = `🆔 ${submission.id}\n`;
      message += `👤 ${lang === 'ar' ? 'المستخدم' : lang === 'en' ? 'User' : 'Пользователь'}: ${submission.username ? '@' + submission.username : submission.user_telegram_id}\n`;
      message += `${statusEmoji[submission.status]} ${lang === 'ar' ? 'الحالة' : lang === 'en' ? 'Status' : 'Статус'}: ${statusTexts[lang][submission.status]}\n`;
      message += `📅 ${lang === 'ar' ? 'التاريخ' : lang === 'en' ? 'Date' : 'Дата'}: ${new Date(submission.created_at).toLocaleDateString(lang === 'ar' ? 'ar-SA' : lang === 'en' ? 'en-US' : 'ru-RU')}\n\n`;

      // إضافة الإثبات النصي إن وجد
      if (submission.proof_text) {
        message += `📝 ${lang === 'ar' ? 'النص' : lang === 'en' ? 'Text' : 'Текст'}:\n${submission.proof_text}\n\n`;
      }

      // إضافة أزرار القبول/الرفض فقط للتقديمات المعلقة
      const buttonTexts = {
        ar: {
          accept: '✅ قبول',
          reject: '❌ رفض'
        },
        en: {
          accept: '✅ Accept',
          reject: '❌ Reject'
        },
        ru: {
          accept: '✅ Принять',
          reject: '❌ Отклонить'
        }
      };
      
      const keyboard = submission.status === 'pending' ? {
        reply_markup: {
          inline_keyboard: [
            [
              { text: buttonTexts[lang].accept, callback_data: `review_accept_${submission.id}` },
              { text: buttonTexts[lang].reject, callback_data: `review_reject_${submission.id}` }
            ]
          ]
        }
      } : {};

      await bot.sendMessage(query.message.chat.id, message, keyboard);

      // إرسال الصور إن وجدت
      if (submission.proof_images) {
        try {
          const images = JSON.parse(submission.proof_images);
          if (images && images.length > 0) {
            for (const imageId of images) {
              await bot.sendPhoto(query.message.chat.id, imageId, {
                caption: `📸 ${lang === 'ar' ? 'صورة الإثبات' : lang === 'en' ? 'Proof Image' : 'Изображение доказательства'} - ${lang === 'ar' ? 'التقديم' : lang === 'en' ? 'Submission' : 'Заявка'} #${submission.id}`
              });
            }
          }
        } catch (error) {
          console.error('Error parsing proof images:', error);
        }
      }
    }
    return;
  }

  if (data.startsWith('resume_task_')) {
    const taskId = parseInt(data.split('_')[2]);
    const user = await User.findByTelegramId(query.from.id);
    const lang = user?.language || 'ar';
    
    if (!user) {
      const messages = {
        ar: '❌ خطأ في التحقق من المستخدم',
        en: '❌ User verification error',
        ru: '❌ Ошибка проверки пользователя'
      };
      await bot.answerCallbackQuery(query.id, { text: messages[lang] });
      return;
    }

    // التحقق من أن المستخدم هو صاحب المهمة
    const isOwner = await Task.isOwner(taskId, user.id);
    
    if (!isOwner) {
      const messages = {
        ar: '❌ غير مصرح لك بتفعيل هذه المهمة',
        en: '❌ You are not authorized to resume this task',
        ru: '❌ У вас нет прав возобновить эту задачу'
      };
      await bot.answerCallbackQuery(query.id, { text: messages[lang] });
      return;
    }

    // تفعيل المهمة
    await Task.updateStatus(taskId, 'active');
    
    // التحقق من وجود تقديمات معلقة
    const pendingCount = await Task.getPendingSubmissionsCount(taskId);
    
    const successMessages = {
      ar: '▶️ تم تفعيل المهمة\n\nستظهر الآن في قائمة المهام المتاحة',
      en: '▶️ Task resumed\n\nIt will now appear in available tasks',
      ru: '▶️ Задача возобновлена\n\nТеперь она будет отображаться в доступных задачах'
    };
    
    await bot.answerCallbackQuery(query.id, { text: '✅' });
    
    const keyboard = [];
    if (pendingCount > 0) {
      const pauseTexts = {
        ar: '⏸️ إيقاف',
        en: '⏸️ Pause',
        ru: '⏸️ Пауза'
      };
      keyboard.push([{ text: pauseTexts[lang], callback_data: `pause_task_${taskId}` }]);
    } else {
      const deleteTexts = {
        ar: '🗑 حذف',
        en: '🗑 Delete',
        ru: '🗑 Удалить'
      };
      keyboard.push([{ text: deleteTexts[lang], callback_data: `delete_task_${taskId}` }]);
    }
    
    await bot.editMessageText(
      query.message.text.replace('🔴 متوقف', '🟢 نشط').replace('🔴 Stopped', '🟢 Active').replace('🔴 Остановлена', '🟢 Активна'),
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        reply_markup: {
          inline_keyboard: keyboard
        }
      }
    );
    
    await bot.sendMessage(query.message.chat.id, successMessages[lang]);
    return;
  }

  if (data.startsWith('delete_task_')) {
    const taskId = parseInt(data.split('_')[2]);
    const user = await User.findByTelegramId(query.from.id);
    
    if (!user) {
      await bot.answerCallbackQuery(query.id, { text: '❌ خطأ في التحقق من المستخدم' });
      return;
    }

    // التحقق من أن المستخدم هو صاحب المهمة
    const isOwner = await Task.isOwner(taskId, user.id);
    
    if (!isOwner) {
      await bot.answerCallbackQuery(query.id, { text: '❌ غير مصرح لك بحذف هذه المهمة' });
      return;
    }

    // حذف المهمة
    await Task.delete(taskId);
    await bot.answerCallbackQuery(query.id, { text: '✅ تم حذف المهمة بنجاح' });

    // حذف الرسالة
    await bot.deleteMessage(query.message.chat.id, query.message.message_id);
    return;
  }

  if (data.startsWith('hide_task_')) {
    const taskId = parseInt(data.split('_')[2]);
    const user = await User.findByTelegramId(query.from.id);
    
    if (user) {
      await HiddenTask.hide(user.id, taskId);
      await bot.answerCallbackQuery(query.id, { text: '✅ تم إخفاء المهمة' });
      
      // تحديث قائمة المهام
      const tasks = await Task.getActiveTasks(user.id);
      
      if (tasks.length === 0) {
        await bot.editMessageText(
          '❌ لا توجد مهام متاحة حالياً',
          { chat_id: query.message.chat.id, message_id: query.message.message_id }
        );
        return;
      }

      let message = '📋 المهام المتاحة (مرتبة حسب أعلى مكافأة):\n\n';
      const keyboard = [];
      
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const isOwner = task.is_owner === 1;
        
        message += `${i + 1}. 🤖 ${task.bot_name}`;
        if (isOwner) {
          message += ` 👤 (مهمتك)`;
        }
        message += `\n`;
        const exchangeRewardText = {
          ar: '+1 نقطة تبادل',
          en: '+1 Exchange Point',
          ru: '+1 Балл обмена'
        };
        const lang = user?.language || 'ar';
        message += `   💰 ${task.task_type === 'paid' ? `${task.reward_per_user} USDT` : exchangeRewardText[lang]}\n`;
        message += `   👥 ${task.completed_count}/${task.required_count}\n\n`;
        
        // إضافة أزرار فقط إذا لم يكن صاحب المهمة
        if (!isOwner) {
          keyboard.push([
            { text: `✅ تنفيذ المهمة ${i + 1}`, callback_data: `execute_task_${task.id}` },
            { text: `❌ إخفاء المهمة ${i + 1}`, callback_data: `hide_task_${task.id}` }
          ]);
        }
      }

      await bot.editMessageText(message, {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    }
    return;
  }

  if (data === 'back_to_menu') {
    const isAdminUser = await Admin.isAdmin(query.from.id);
    await bot.editMessageText(
      query.message.text,
      { chat_id: query.message.chat.id, message_id: query.message.message_id }
    );
    await bot.sendMessage(query.message.chat.id, '📋 القائمة الرئيسية:', isAdminUser ? adminMenu : mainMenu);
    await bot.answerCallbackQuery(query.id);
    return;
  }

  // معالجات التقييمات
  if (data.startsWith('rate_user_')) {
    await handleRateUser(bot, query);
    return;
  }

  if (data.startsWith('rating_')) {
    await handleRatingSelection(bot, query);
    return;
  }

  if (data.startsWith('skip_comment_')) {
    await handleSkipComment(bot, query);
    return;
  }

  // معالجات الرسائل الجماعية
  if (data.startsWith('broadcast_target_')) {
    await handleBroadcastTarget(bot, query);
    return;
  }

  if (data.startsWith('broadcast_send_')) {
    await handleBroadcastSend(bot, query);
    return;
  }

  if (data.startsWith('broadcast_cancel_')) {
    await handleBroadcastCancel(bot, query);
    return;
  }

  // معالجات الاستئنافات
  if (data.startsWith('appeal_approve_') || data.startsWith('appeal_reject_')) {
    await handleAppealReview(bot, query);
    return;
  }
});

// معالج الأخطاء
bot.on('polling_error', (error) => {
  logError('POLLING', 'Polling error occurred', error);
});

process.on('SIGINT', () => {
  logSeparator();
  logInfo('SHUTDOWN', '👋 إيقاف البوت...');
  bot.stopPolling();
  db.close();
  process.exit(0);
});
