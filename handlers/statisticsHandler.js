import Statistics from '../models/Statistics.js';
import config from '../config.js';
import { adminPanelKeyboard } from '../utils/keyboards.js';
import { logInfo, logSuccess, logError } from '../utils/logger.js';
import Admin from '../models/Admin.js';

export async function handleStatistics(bot, msg) {
  const chatId = msg.chat.id;
  
  const isAdmin = await Admin.isAdmin(msg.from.id);
  if (!isAdmin) {
    await bot.sendMessage(chatId, '❌ غير مصرح لك بهذا الأمر');
    return;
  }

  try {
    logInfo('STATS', `Admin ${msg.from.id} requested statistics`);
    
    await bot.sendMessage(chatId, '⏳ جاري جمع الإحصائيات...');
    
    const stats = await Statistics.getAllStats();
    
    let message = '📊 **إحصائيات البوت الشاملة**\n\n';
    
    // إحصائيات المستخدمين
    message += '👥 **المستخدمون:**\n';
    message += `├ إجمالي المستخدمين: ${stats.users.total_users}\n`;
    message += `├ المستخدمون النشطون: ${stats.users.active_users}\n`;
    message += `├ المستخدمون المحظورون: ${stats.users.banned_users}\n`;
    message += `└ إجمالي الأرصدة: ${(stats.users.total_balance || 0).toFixed(2)} USDT\n\n`;
    
    // توزيع المستخدمين حسب اللغة
    if (stats.usersByLanguage && stats.usersByLanguage.length > 0) {
      message += '🌐 **المستخدمون حسب اللغة:**\n';
      stats.usersByLanguage.forEach(lang => {
        const langName = lang.language === 'ar' ? '🇸🇦 عربي' : 
                        lang.language === 'en' ? '🇬🇧 English' : 
                        lang.language === 'ru' ? '🇷🇺 Русский' : lang.language;
        message += `├ ${langName}: ${lang.count}\n`;
      });
      message += '\n';
    }
    
    // إحصائيات المهام
    message += '📋 **المهام:**\n';
    message += `├ إجمالي المهام: ${stats.tasks.total_tasks}\n`;
    message += `├ المهام النشطة: ${stats.tasks.active_tasks}\n`;
    message += `├ المهام المكتملة: ${stats.tasks.completed_tasks}\n`;
    message += `├ المهام الملغاة: ${stats.tasks.cancelled_tasks}\n`;
    message += `├ المهام المدفوعة: ${stats.tasks.paid_tasks}\n`;
    message += `├ مهام التبادل: ${stats.tasks.exchange_tasks}\n`;
    message += `└ إجمالي المكافآت: ${(stats.tasks.total_rewards || 0).toFixed(2)} USDT\n\n`;
    
    // إحصائيات الإثباتات
    message += '📝 **الإثباتات:**\n';
    message += `├ إجمالي الإثباتات: ${stats.submissions.total_submissions}\n`;
    message += `├ معلقة: ${stats.submissions.pending_submissions}\n`;
    message += `├ مقبولة: ${stats.submissions.approved_submissions}\n`;
    message += `├ مرفوضة: ${stats.submissions.rejected_submissions}\n`;
    message += `└ مرفوضة نهائياً: ${stats.submissions.final_rejected_submissions}\n\n`;
    
    // إحصائيات التقييمات
    if (stats.ratings && stats.ratings.total_ratings > 0) {
      message += '⭐ **التقييمات:**\n';
      message += `├ إجمالي التقييمات: ${stats.ratings.total_ratings}\n`;
      message += `├ متوسط التقييم: ${(stats.ratings.avg_rating || 0).toFixed(1)}/5\n`;
      message += `├ 5 نجوم: ${stats.ratings.five_stars}\n`;
      message += `├ 4 نجوم: ${stats.ratings.four_stars}\n`;
      message += `├ 3 نجوم: ${stats.ratings.three_stars}\n`;
      message += `├ 2 نجوم: ${stats.ratings.two_stars}\n`;
      message += `└ 1 نجمة: ${stats.ratings.one_star}\n\n`;
    }
    
    // إحصائيات الإيداعات
    message += '💳 **الإيداعات:**\n';
    message += `├ إجمالي الإيداعات: ${stats.deposits.total_deposits}\n`;
    message += `├ معلقة: ${stats.deposits.pending_deposits}\n`;
    message += `├ مقبولة: ${stats.deposits.approved_deposits}\n`;
    message += `├ مرفوضة: ${stats.deposits.rejected_deposits}\n`;
    message += `└ إجمالي المبالغ: ${(stats.deposits.total_deposited || 0).toFixed(2)} USDT\n\n`;
    
    // إحصائيات السحوبات
    message += '💸 **السحوبات:**\n';
    message += `├ إجمالي السحوبات: ${stats.withdrawals.total_withdrawals}\n`;
    message += `├ معلقة: ${stats.withdrawals.pending_withdrawals}\n`;
    message += `├ مكتملة: ${stats.withdrawals.completed_withdrawals}\n`;
    message += `├ مرفوضة: ${stats.withdrawals.rejected_withdrawals}\n`;
    message += `└ إجمالي المبالغ: ${(stats.withdrawals.total_withdrawn || 0).toFixed(2)} USDT\n\n`;
    
    // إحصائيات المخالفات
    message += '⚖️ **المخالفات (آخر 30 يوم):**\n';
    message += `├ إجمالي المخالفات: ${stats.violations.total_violations || 0}\n`;
    message += `├ مستخدمون بمخالفات: ${stats.violations.users_with_violations || 0}\n`;
    message += `└ إجمالي النقاط: ${stats.violations.total_points || 0}\n\n`;
    
    // إحصائيات الحظر
    if (stats.bans && stats.bans.total_bans > 0) {
      message += '🚫 **الحظر:**\n';
      message += `├ إجمالي الحظر: ${stats.bans.total_bans}\n`;
      message += `├ حظر دائم: ${stats.bans.permanent_bans}\n`;
      message += `├ حظر مؤقت: ${stats.bans.temporary_bans}\n`;
      message += `└ حظر نشط: ${stats.bans.active_bans}\n\n`;
    }
    
    // إحصائيات الاستئنافات
    if (stats.appeals && stats.appeals.total_appeals > 0) {
      message += '📋 **الاستئنافات:**\n';
      message += `├ إجمالي الاستئنافات: ${stats.appeals.total_appeals}\n`;
      message += `├ معلقة: ${stats.appeals.pending_appeals}\n`;
      message += `├ مقبولة: ${stats.appeals.approved_appeals}\n`;
      message += `└ مرفوضة: ${stats.appeals.rejected_appeals}\n\n`;
    }
    
    // إحصائيات الرسائل الجماعية
    if (stats.broadcasts && stats.broadcasts.total_broadcasts > 0) {
      message += '📢 **الرسائل الجماعية:**\n';
      message += `├ إجمالي الرسائل: ${stats.broadcasts.total_broadcasts}\n`;
      message += `├ مكتملة: ${stats.broadcasts.completed_broadcasts}\n`;
      message += `├ تم إرسالها: ${stats.broadcasts.total_sent || 0}\n`;
      message += `└ فشلت: ${stats.broadcasts.total_failed || 0}\n\n`;
    }
    
    // إحصائيات الأدمنز
    if (stats.admins && stats.admins.total_admins > 0) {
      message += '👨‍💼 **الأدمنز:**\n';
      message += `├ إجمالي الأدمنز: ${stats.admins.total_admins + 1}\n`; // +1 للأدمن الرئيسي
      message += `├ نشطون: ${stats.admins.active_admins}\n`;
      message += `└ غير نشطين: ${stats.admins.inactive_admins}\n\n`;
    }
    
    // الصافي
    const netBalance = (stats.deposits.total_deposited || 0) - (stats.withdrawals.total_withdrawn || 0);
    message += '💰 **الصافي:**\n';
    message += `└ ${netBalance >= 0 ? '+' : ''}${netBalance.toFixed(2)} USDT\n`;
    
    await bot.sendMessage(chatId, message, { 
      parse_mode: 'Markdown',
      ...adminPanelKeyboard 
    });
    
    logSuccess('STATS', 'Statistics sent successfully');
  } catch (error) {
    logError('STATS', 'Failed to get statistics', error);
    await bot.sendMessage(chatId, `❌ حدث خطأ أثناء جمع الإحصائيات\n\nالخطأ: ${error.message}`);
  }
}

export async function handleTopUsers(bot, msg) {
  const chatId = msg.chat.id;
  
  const isAdmin = await Admin.isAdmin(msg.from.id);
  if (!isAdmin) {
    await bot.sendMessage(chatId, '❌ غير مصرح لك بهذا الأمر');
    return;
  }

  try {
    logInfo('STATS', `Admin ${msg.from.id} requested top users`);
    
    const topUsers = await Statistics.getTopUsers(10);
    
    if (topUsers.length === 0) {
      await bot.sendMessage(chatId, '📊 لا يوجد مستخدمون نشطون بعد');
      return;
    }
    
    let message = '🏆 **أفضل 10 مستخدمين**\n\n';
    
    topUsers.forEach((user, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      message += `${medal} @${user.username || 'مستخدم'}\n`;
      message += `   ├ المهام المكتملة: ${user.completed_tasks}\n`;
      message += `   ├ المهام المنشأة: ${user.created_tasks}\n`;
      message += `   ├ التقييم: ${user.avg_rating > 0 ? user.avg_rating.toFixed(1) + '⭐' : 'لا يوجد'}\n`;
      message += `   └ الرصيد: ${user.balance.toFixed(2)} USDT\n\n`;
    });
    
    await bot.sendMessage(chatId, message, { 
      parse_mode: 'Markdown',
      ...adminPanelKeyboard 
    });
    
    logSuccess('STATS', 'Top users sent successfully');
  } catch (error) {
    logError('STATS', 'Failed to get top users', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ أثناء جمع البيانات');
  }
}
