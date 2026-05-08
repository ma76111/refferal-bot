import User from '../models/User.js';
import Admin from '../models/Admin.js';
import Settings from '../models/Settings.js';
import config from '../config.js';
import { adminMenu, getMainMenuKeyboard, languageKeyboard, adminPanelKeyboard, mainAdminPanelKeyboard } from '../utils/keyboards.js';
import { logInfo, logSuccess, logWarning, logError } from '../utils/logger.js';

const adminStates = new Map();

// دالة مساعدة للحصول على keyboard المناسب للأدمن
function getAdminKeyboard(telegramId) {
  return Admin.isMainAdmin(telegramId) ? mainAdminPanelKeyboard : adminPanelKeyboard;
}

export async function handleAdminPanel(bot, msg) {
  const chatId = msg.chat.id;
  
  // التحقق من أن المستخدم أدمن (رئيسي أو ثانوي)
  const isAdmin = await Admin.isAdmin(msg.from.id);
  if (!isAdmin) {
    await bot.sendMessage(chatId, '❌ غير مصرح لك بهذا الأمر');
    return;
  }

  // استخدام keyboard مختلف حسب نوع الأدمن
  const keyboard = Admin.isMainAdmin(msg.from.id) ? mainAdminPanelKeyboard : adminPanelKeyboard;

  await bot.sendMessage(
    chatId,
    '⚙️ لوحة تحكم الأدمن\n\nاختر الإجراء المطلوب:',
    keyboard
  );
}

export async function handleSearchUser(bot, msg) {
  const chatId = msg.chat.id;
  
  const isAdmin = await Admin.isAdmin(msg.from.id);
  if (!isAdmin) {
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
  
  const isAdmin = await Admin.isAdmin(msg.from.id);
  if (!isAdmin) {
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
    await bot.sendMessage(chatId, '❌ تم إلغاء العملية', getAdminKeyboard(msg.from.id));
    return true;
  }

  switch (state.step) {
    case 'awaiting_search_query':
      const users = await User.searchByIdOrUsername(msg.text);
      
      if (users.length === 0) {
        await bot.sendMessage(chatId, '❌ لم يتم العثور على مستخدمين', getAdminKeyboard(msg.from.id));
        adminStates.delete(chatId);
        return true;
      }

      // عرض كل مستخدم مع أزرار التحكم
      for (const user of users) {
        let message = '👤 معلومات المستخدم:\n\n';
        message += `🆔 ID: ${user.telegram_id}\n`;
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

        await bot.sendMessage(chatId, message, keyboard);
      }

      adminStates.delete(chatId);
      break;

    case 'awaiting_support_text':
      await Settings.setSupportText(state.language, msg.text);
      await bot.sendMessage(
        chatId,
        `✅ تم تحديث نص الدعم للغة ${state.language === 'ar' ? 'العربية' : state.language === 'en' ? 'الإنجليزية' : 'الروسية'}`,
        getAdminKeyboard(msg.from.id)
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
        getAdminKeyboard(msg.from.id)
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
        getAdminKeyboard(msg.from.id)
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
        getAdminKeyboard(msg.from.id)
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
        getAdminKeyboard(msg.from.id)
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
        getAdminKeyboard(msg.from.id)
      );
      adminStates.delete(chatId);
      break;

    case 'awaiting_min_reward':
      const minReward = parseFloat(msg.text);
      if (isNaN(minReward) || minReward < 0) {
        await bot.sendMessage(chatId, '❌ الرجاء إرسال مبلغ صحيح (يجب أن يكون 0 أو أكثر)');
        return true;
      }
      await Settings.setMinReward(minReward);
      await bot.sendMessage(
        chatId,
        `✅ تم تحديث الحد الأدنى للمكافأة إلى: ${minReward} USDT`,
        getAdminKeyboard(msg.from.id)
      );
      adminStates.delete(chatId);
      break;

    case 'awaiting_min_withdrawal':
      const minWithdrawal = parseFloat(msg.text);
      if (isNaN(minWithdrawal) || minWithdrawal < 0) {
        await bot.sendMessage(chatId, '❌ الرجاء إرسال مبلغ صحيح (يجب أن يكون 0 أو أكثر)');
        return true;
      }
      await Settings.setMinWithdrawal(minWithdrawal);
      await bot.sendMessage(
        chatId,
        `✅ تم تحديث الحد الأدنى للسحب إلى: ${minWithdrawal} USDT`,
        getAdminKeyboard(msg.from.id)
      );
      adminStates.delete(chatId);
      break;

    case 'awaiting_admin_id':
      const adminId = parseInt(msg.text);
      if (isNaN(adminId)) {
        await bot.sendMessage(chatId, '❌ الرجاء إرسال ID صحيح (أرقام فقط)');
        return true;
      }

      try {
        // البحث عن المستخدم
        const user = await User.findByTelegramId(adminId);
        if (!user) {
          await bot.sendMessage(
            chatId,
            '❌ المستخدم غير موجود في قاعدة البيانات\n\n💡 يجب أن يكون المستخدم قد استخدم البوت مرة واحدة على الأقل',
            mainAdminPanelKeyboard
          );
          adminStates.delete(chatId);
          return true;
        }

        await Admin.addAdmin(adminId, user.username, msg.from.id);
        await bot.sendMessage(
          chatId,
          `✅ تم إضافة الأدمن بنجاح!\n\n🆔 ID: ${adminId}\n👤 ${user.username || 'بدون يوزرنيم'}`,
          mainAdminPanelKeyboard
        );
        
        // إرسال إشعار للأدمن الجديد
        try {
          await bot.sendMessage(
            adminId,
            '🎉 تهانينا!\n\nتم إضافتك كأدمن ثانوي في البوت\n\nيمكنك الآن الوصول إلى لوحة التحكم'
          );
        } catch (err) {
          // تجاهل الخطأ إذا لم نستطع إرسال الرسالة
        }
      } catch (error) {
        if (error.message === 'Admin already exists') {
          await bot.sendMessage(chatId, '❌ هذا المستخدم أدمن بالفعل', mainAdminPanelKeyboard);
        } else if (error.message === 'Cannot add main admin as secondary admin') {
          await bot.sendMessage(chatId, '❌ لا يمكن إضافة الأدمن الرئيسي كأدمن ثانوي', mainAdminPanelKeyboard);
        } else {
          await bot.sendMessage(chatId, '❌ حدث خطأ أثناء إضافة الأدمن', mainAdminPanelKeyboard);
          logError('ADMIN', 'Error adding admin', error);
        }
      }
      adminStates.delete(chatId);
      break;

    case 'awaiting_remove_admin_id':
      const removeAdminId = parseInt(msg.text);
      if (isNaN(removeAdminId)) {
        await bot.sendMessage(chatId, '❌ الرجاء إرسال ID صحيح (أرقام فقط)');
        return true;
      }

      try {
        const removed = await Admin.removeAdmin(removeAdminId, msg.from.id);
        if (removed) {
          await bot.sendMessage(
            chatId,
            `✅ تم إزالة الأدمن بنجاح!\n\n🆔 ID: ${removeAdminId}`,
            mainAdminPanelKeyboard
          );
          
          // إرسال إشعار للأدمن المحذوف
          try {
            await bot.sendMessage(
              removeAdminId,
              '⚠️ تم إزالتك من قائمة الأدمنز\n\nلم تعد تملك صلاحيات الأدمن'
            );
          } catch (err) {
            // تجاهل الخطأ
          }
        } else {
          await bot.sendMessage(chatId, '❌ الأدمن غير موجود', mainAdminPanelKeyboard);
        }
      } catch (error) {
        if (error.message === 'Cannot remove main admin') {
          await bot.sendMessage(chatId, '❌ لا يمكن إزالة الأدمن الرئيسي', mainAdminPanelKeyboard);
        } else {
          await bot.sendMessage(chatId, '❌ حدث خطأ أثناء إزالة الأدمن', mainAdminPanelKeyboard);
          logError('ADMIN', 'Error removing admin', error);
        }
      }
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
    const isAdmin = await Admin.isAdmin(query.from.id);
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

// ============= إدارة الأدمنز الثانويين =============

export async function handleManageAdmins(bot, msg) {
  const chatId = msg.chat.id;
  
  // فقط الأدمن الرئيسي يمكنه إدارة الأدمنز
  if (!Admin.isMainAdmin(msg.from.id)) {
    await bot.sendMessage(chatId, '❌ هذه الميزة متاحة فقط للأدمن الرئيسي');
    return;
  }

  const admins = await Admin.getAllAdmins();
  
  let message = '👥 إدارة الأدمنز الثانويين\n\n';
  message += `👑 الأدمن الرئيسي: ${msg.from.id}\n\n`;
  
  if (admins.length === 0) {
    message += '📋 لا يوجد أدمنز ثانويين حالياً\n\n';
  } else {
    message += '📋 الأدمنز الثانويين:\n\n';
    admins.forEach((admin, index) => {
      const status = admin.is_active ? '🟢' : '🔴';
      message += `${index + 1}. ${status} ID: ${admin.telegram_id}\n`;
      message += `   👤 ${admin.username || 'بدون يوزرنيم'}\n`;
      message += `   📅 ${new Date(admin.created_at).toLocaleDateString('ar')}\n\n`;
    });
  }
  
  message += '💡 استخدم الأزرار أدناه للإدارة:';

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '➕ إضافة أدمن', callback_data: 'admin_add_admin' }],
        [{ text: '➖ إزالة أدمن', callback_data: 'admin_remove_admin' }],
        [{ text: '📋 عرض الأدمنز', callback_data: 'admin_list_admins' }],
        [{ text: '🔙 رجوع', callback_data: 'back_to_admin_panel' }]
      ]
    }
  };

  await bot.sendMessage(chatId, message, keyboard);
}

export async function handleAddAdmin(bot, msg) {
  const chatId = msg.chat.id;
  
  if (!Admin.isMainAdmin(msg.from.id)) {
    await bot.sendMessage(chatId, '❌ هذه الميزة متاحة فقط للأدمن الرئيسي');
    return;
  }

  adminStates.set(chatId, { step: 'awaiting_admin_id' });
  
  await bot.sendMessage(
    chatId,
    '➕ إضافة أدمن ثانوي\n\nأرسل ID المستخدم الذي تريد إضافته كأدمن:',
    {
      reply_markup: {
        keyboard: [['❌ إلغاء']],
        resize_keyboard: true
      }
    }
  );
}

export async function handleRemoveAdmin(bot, msg) {
  const chatId = msg.chat.id;
  
  if (!Admin.isMainAdmin(msg.from.id)) {
    await bot.sendMessage(chatId, '❌ هذه الميزة متاحة فقط للأدمن الرئيسي');
    return;
  }

  const admins = await Admin.getAllAdmins();
  
  if (admins.length === 0) {
    await bot.sendMessage(chatId, '❌ لا يوجد أدمنز ثانويين لإزالتهم', mainAdminPanelKeyboard);
    return;
  }

  adminStates.set(chatId, { step: 'awaiting_remove_admin_id' });
  
  let message = '➖ إزالة أدمن ثانوي\n\n';
  message += 'الأدمنز الحاليين:\n\n';
  admins.forEach((admin, index) => {
    message += `${index + 1}. ID: ${admin.telegram_id} - ${admin.username || 'بدون يوزرنيم'}\n`;
  });
  message += '\nأرسل ID الأدمن الذي تريد إزالته:';

  await bot.sendMessage(
    chatId,
    message,
    {
      reply_markup: {
        keyboard: [['❌ إلغاء']],
        resize_keyboard: true
      }
    }
  );
}
