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
    await bot.sendMessage(chatId, '❌ حدث خطأ أثناء جمع الإحصائيات');
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
