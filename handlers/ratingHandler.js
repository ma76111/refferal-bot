import Rating from '../models/Rating.js';
import User from '../models/User.js';
import Task from '../models/Task.js';
import Submission from '../models/Submission.js';
import { logInfo, logSuccess, logError, logWarning } from '../utils/logger.js';
import { handleStateInterruption } from '../utils/stateManager.js';

const ratingStates = new Map();

export async function handleRateUser(bot, query) {
  const chatId = query.message.chat.id;
  const data = query.data; // rate_user_taskId_userId
  const parts = data.split('_');
  const taskId = parseInt(parts[2]);
  const ratedUserId = parseInt(parts[3]);
  
  logInfo('RATING', `User ${query.from.id} initiating rating for user ${ratedUserId}`);
  
  try {
    const raterUser = await User.findByTelegramId(query.from.id);
    const task = await Task.getById(taskId);
    
    if (!task) {
      await bot.answerCallbackQuery(query.id, { text: '❌ المهمة غير موجودة' });
      return;
    }
    
    // التحقق من أن المستخدم هو صاحب المهمة
    if (task.owner_id !== raterUser.id) {
      await bot.answerCallbackQuery(query.id, { text: '❌ يمكن فقط لصاحب المهمة التقييم' });
      return;
    }
    
    // التحقق من عدم وجود تقييم سابق
    const exists = await Rating.checkExists(taskId, raterUser.id);
    if (exists) {
      await bot.answerCallbackQuery(query.id, { text: '⚠️ لقد قيمت هذا المستخدم مسبقاً' });
      return;
    }
    
    const ratedUser = await User.findById(ratedUserId);
    
    const keyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⭐⭐⭐⭐⭐ (5)', callback_data: `rating_${taskId}_${ratedUserId}_5` },
            { text: '⭐⭐⭐⭐ (4)', callback_data: `rating_${taskId}_${ratedUserId}_4` }
          ],
          [
            { text: '⭐⭐⭐ (3)', callback_data: `rating_${taskId}_${ratedUserId}_3` },
            { text: '⭐⭐ (2)', callback_data: `rating_${taskId}_${ratedUserId}_2` }
          ],
          [
            { text: '⭐ (1)', callback_data: `rating_${taskId}_${ratedUserId}_1` }
          ],
          [
            { text: '❌ إلغاء', callback_data: 'cancel' }
          ]
        ]
      }
    };
    
    await bot.editMessageText(
      `⭐ تقييم المستخدم @${ratedUser.username || 'مستخدم'}\n\n` +
      `📋 المهمة: ${task.bot_name}\n\n` +
      `اختر التقييم:`,
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        ...keyboard
      }
    );
    
    await bot.answerCallbackQuery(query.id);
  } catch (error) {
    logError('RATING', 'Failed to initiate rating', error);
    await bot.answerCallbackQuery(query.id, { text: '❌ حدث خطأ' });
  }
}

export async function handleRatingSelection(bot, query) {
  const chatId = query.message.chat.id;
  const data = query.data; // rating_taskId_userId_rating
  const parts = data.split('_');
  const taskId = parseInt(parts[1]);
  const ratedUserId = parseInt(parts[2]);
  const rating = parseInt(parts[3]);
  
  logInfo('RATING', `User ${query.from.id} selected rating ${rating} for user ${ratedUserId}`);
  
  try {
    const raterUser = await User.findByTelegramId(query.from.id);
    
    // حفظ الحالة لطلب التعليق
    ratingStates.set(chatId, {
      taskId,
      raterUserId: raterUser.id,
      ratedUserId,
      rating,
      step: 'awaiting_comment',
      timestamp: Date.now() // ✅ إضافة timestamp
    });
    
    await bot.editMessageText(
      `⭐ تقييم: ${rating}/5\n\n` +
      `📝 أرسل تعليقاً (اختياري) أو اضغط "تخطي":`,
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: '⏭️ تخطي', callback_data: `skip_comment_${taskId}_${ratedUserId}_${rating}` }],
            [{ text: '❌ إلغاء', callback_data: 'cancel' }]
          ]
        }
      }
    );
    
    await bot.answerCallbackQuery(query.id);
  } catch (error) {
    logError('RATING', 'Failed to process rating selection', error);
    await bot.answerCallbackQuery(query.id, { text: '❌ حدث خطأ' });
  }
}

export async function handleSkipComment(bot, query) {
  const chatId = query.message.chat.id;
  const data = query.data; // skip_comment_taskId_userId_rating
  const parts = data.split('_');
  const taskId = parseInt(parts[2]);
  const ratedUserId = parseInt(parts[3]);
  const rating = parseInt(parts[4]);
  
  logInfo('RATING', `User ${query.from.id} skipped comment`);
  
  try {
    const raterUser = await User.findByTelegramId(query.from.id);
    
    await Rating.create(taskId, raterUser.id, ratedUserId, rating, null);
    
    const ratedUser = await User.findById(ratedUserId);
    const { avgRating, totalRatings } = await Rating.getAverageRating(ratedUserId);
    
    await bot.editMessageText(
      `✅ تم إرسال التقييم بنجاح!\n\n` +
      `⭐ التقييم: ${rating}/5\n` +
      `👤 المستخدم: @${ratedUser.username || 'مستخدم'}\n\n` +
      `📊 متوسط تقييمه الآن: ${avgRating}/5 (${totalRatings} تقييم)`,
      {
        chat_id: chatId,
        message_id: query.message.message_id
      }
    );
    
    // إشعار المستخدم المُقيَّم
    await bot.sendMessage(
      ratedUser.telegram_id,
      `⭐ تقييم جديد!\n\n` +
      `لقد حصلت على تقييم ${rating}/5\n` +
      `📊 متوسط تقييمك: ${avgRating}/5 (${totalRatings} تقييم)`
    );
    
    ratingStates.delete(chatId);
    await bot.answerCallbackQuery(query.id, { text: '✅ تم إرسال التقييم' });
    
    logSuccess('RATING', `Rating ${rating}/5 created successfully`);
  } catch (error) {
    logError('RATING', 'Failed to create rating', error);
    await bot.answerCallbackQuery(query.id, { text: '❌ حدث خطأ' });
  }
}

export async function handleRatingComment(bot, msg) {
  const chatId = msg.chat.id;
  const state = ratingStates.get(chatId);
  
  if (!state || state.step !== 'awaiting_comment') return false;
  
  // استخدام الدالة المركزية للتحقق من أزرار القائمة
  if (handleStateInterruption(ratingStates, chatId, msg.text, false)) {
    return false;
  }
  
  const comment = msg.text;
  
  logInfo('RATING', `User ${msg.from.id} added comment: ${comment.substring(0, 50)}...`);
  
  try {
    await Rating.create(state.taskId, state.raterUserId, state.ratedUserId, state.rating, comment);
    
    const ratedUser = await User.findById(state.ratedUserId);
    const { avgRating, totalRatings } = await Rating.getAverageRating(state.ratedUserId);
    
    await bot.sendMessage(
      chatId,
      `✅ تم إرسال التقييم بنجاح!\n\n` +
      `⭐ التقييم: ${state.rating}/5\n` +
      `💬 التعليق: ${comment}\n` +
      `👤 المستخدم: @${ratedUser.username || 'مستخدم'}\n\n` +
      `📊 متوسط تقييمه الآن: ${avgRating}/5 (${totalRatings} تقييم)`
    );
    
    // إشعار المستخدم المُقيَّم
    await bot.sendMessage(
      ratedUser.telegram_id,
      `⭐ تقييم جديد!\n\n` +
      `لقد حصلت على تقييم ${state.rating}/5\n` +
      `💬 التعليق: ${comment}\n\n` +
      `📊 متوسط تقييمك: ${avgRating}/5 (${totalRatings} تقييم)`
    );
    
    ratingStates.delete(chatId);
    logSuccess('RATING', `Rating ${state.rating}/5 with comment created successfully`);
    return true;
  } catch (error) {
    logError('RATING', 'Failed to create rating with comment', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ أثناء إرسال التقييم');
    return true;
  }
}

export async function handleViewRatings(bot, msg) {
  const chatId = msg.chat.id;
  
  try {
    const user = await User.findByTelegramId(msg.from.id);
    const { avgRating, totalRatings } = await Rating.getAverageRating(user.id);
    const distribution = await Rating.getRatingDistribution(user.id);
    const recentRatings = await Rating.getUserRatings(user.id, 5);
    
    let message = `⭐ **تقييماتك**\n\n`;
    message += `📊 متوسط التقييم: ${avgRating}/5\n`;
    message += `🔢 عدد التقييمات: ${totalRatings}\n\n`;
    
    if (totalRatings > 0) {
      message += `📈 **التوزيع:**\n`;
      message += `⭐⭐⭐⭐⭐ (5): ${distribution[5]} تقييم\n`;
      message += `⭐⭐⭐⭐ (4): ${distribution[4]} تقييم\n`;
      message += `⭐⭐⭐ (3): ${distribution[3]} تقييم\n`;
      message += `⭐⭐ (2): ${distribution[2]} تقييم\n`;
      message += `⭐ (1): ${distribution[1]} تقييم\n\n`;
      
      if (recentRatings.length > 0) {
        message += `📝 **آخر التقييمات:**\n\n`;
        recentRatings.forEach((r, i) => {
          message += `${i + 1}. ⭐ ${r.rating}/5 - @${r.rater_username}\n`;
          message += `   📋 ${r.task_title}\n`;
          if (r.comment) {
            message += `   💬 ${r.comment}\n`;
          }
          message += `\n`;
        });
      }
    } else {
      message += `\n💡 لم تحصل على أي تقييمات بعد`;
    }
    
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    
    logSuccess('RATING', `Ratings displayed for user ${msg.from.id}`);
  } catch (error) {
    logError('RATING', 'Failed to display ratings', error);
    await bot.sendMessage(chatId, '❌ حدث خطأ أثناء عرض التقييمات');
  }
}

export { ratingStates };
