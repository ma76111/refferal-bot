import User from '../models/User.js';
import Violation, { VIOLATION_TYPES, PENALTY_LEVELS } from '../models/Violation.js';
import Ban from '../models/Ban.js';
import Restriction, { RESTRICTION_TYPES } from '../models/Restriction.js';
import Settings from '../models/Settings.js';
import logger from './logger.js';

/**
 * نظام المخالفات المتقدم
 * يدير المخالفات والعقوبات والحظر التلقائي
 */
export default class ViolationSystem {
  /**
   * إضافة مخالفة للمستخدم
   * @param {number} userId - معرف المستخدم
   * @param {string} violationType - نوع المخالفة
   * @param {string} reason - سبب المخالفة
   * @param {number} adminId - معرف الأدمن (اختياري)
   */
  static async addViolation(userId, violationType, reason, adminId = null) {
    try {
      logger.info(`Adding violation: user=${userId}, type=${violationType}`);
      
      // الحصول على نقاط المخالفة
      const violationConfig = VIOLATION_TYPES[violationType];
      if (!violationConfig) {
        throw new Error(`Unknown violation type: ${violationType}`);
      }
      
      const points = violationConfig.points;
      
      // إضافة المخالفة إلى جدول المخالفات
      await Violation.create({
        userId,
        type: violationConfig.name,
        points,
        reason,
        expiresAt: null // يمكن تعديله لاحقاً لإضافة مخالفات مؤقتة
      });
      
      // تحديث نقاط المستخدم
      await User.addViolationPoints(userId, points);
      
      // الحصول على إجمالي النقاط
      const totalPoints = await User.getViolationPoints(userId);
      logger.info(`User ${userId} now has ${totalPoints} violation points`);
      
      // تطبيق العقوبة المناسبة
      await this.applyPenalty(userId, totalPoints, reason, adminId);
      
      return { success: true, points, totalPoints };
    } catch (error) {
      logger.error(`Failed to add violation: ${error.message}`);
      throw error;
    }
  }

  /**
   * تطبيق العقوبة بناءً على النقاط
   */
  static async applyPenalty(userId, totalPoints, reason, adminId = null) {
    try {
      const penalty = Violation.getPenaltyLevel(totalPoints);
      
      if (!penalty) {
        logger.info(`No penalty for ${totalPoints} points`);
        return;
      }
      
      logger.info(`Applying penalty: ${penalty.action} for user ${userId}`);
      
      switch (penalty.action) {
        case 'warning':
          // تحذير فقط - لا إجراء
          logger.info(`Warning issued to user ${userId}`);
          break;
          
        case 'restriction':
          // تقييد - منع إضافة مهام لمدة 24 ساعة
          await Restriction.create({
            userId,
            type: RESTRICTION_TYPES.NO_TASK_CREATION,
            duration: 24, // 24 ساعة
            reason: `تحذير ثاني - ${totalPoints} نقاط مخالفة`
          });
          await User.addRestriction(userId, RESTRICTION_TYPES.NO_TASK_CREATION);
          logger.success(`Restriction applied to user ${userId}`);
          break;
          
        case 'temp_ban':
          // حظر مؤقت
          const duration = penalty.duration; // بالأيام
          await Ban.create({
            userId,
            type: 'temporary',
            duration,
            reason: `${totalPoints} نقاط مخالفة - ${reason}`,
            bannedBy: adminId
          });
          
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + duration);
          await User.updateBanStatus(userId, 'temporary', expiresAt.toISOString());
          
          logger.success(`Temporary ban (${duration} days) applied to user ${userId}`);
          break;
          
        case 'permanent_ban':
          // حظر دائم
          await Ban.create({
            userId,
            type: 'permanent',
            duration: null,
            reason: `${totalPoints} نقاط مخالفة - ${reason}`,
            bannedBy: adminId
          });
          
          await User.updateBanStatus(userId, 'permanent', null);
          logger.success(`Permanent ban applied to user ${userId}`);
          break;
      }
      
      return penalty;
    } catch (error) {
      logger.error(`Failed to apply penalty: ${error.message}`);
      throw error;
    }
  }

  /**
   * التحقق من حالة المستخدم
   */
  static async checkUserStatus(userId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        return { allowed: false, reason: 'user_not_found' };
      }
      
      // التحقق من الحظر
      if (user.ban_status === 'permanent') {
        return { 
          allowed: false, 
          reason: 'permanently_banned',
          banStatus: user.ban_status
        };
      }
      
      if (user.ban_status === 'temporary') {
        const now = new Date();
        const expiresAt = new Date(user.ban_expires_at);
        
        if (now < expiresAt) {
          const remaining = Ban.getRemainingTime({ 
            type: 'temporary', 
            end_date: user.ban_expires_at 
          });
          
          return { 
            allowed: false, 
            reason: 'temporarily_banned',
            banStatus: user.ban_status,
            expiresAt: user.ban_expires_at,
            remaining
          };
        } else {
          // انتهى الحظر المؤقت - رفعه تلقائياً
          await User.updateBanStatus(userId, 'none', null);
        }
      }
      
      return { 
        allowed: true, 
        violationPoints: user.violation_points,
        restrictions: user.restrictions ? JSON.parse(user.restrictions) : []
      };
    } catch (error) {
      logger.error(`Failed to check user status: ${error.message}`);
      throw error;
    }
  }

  /**
   * الحصول على رسالة العقوبة (بدون عرض النقاط)
   */
  static getPenaltyMessage(penalty, totalPoints, lang = 'ar') {
    const messages = {
      ar: {
        warning: `⚠️ تحذير أول\n\n💡 يرجى الالتزام بقواعد البوت لتجنب العقوبات\n\n⚠️ استمرار المخالفات سيؤدي إلى تقييدات وحظر`,
        restriction: `⚠️ تحذير ثاني + تقييد\n\n🚫 تم منعك من إضافة مهام جديدة لمدة 24 ساعة\n\n💡 استمرار المخالفات سيؤدي إلى حظر مؤقت`,
        temp_ban: `🚫 حظر مؤقت\n\n⏰ تم حظرك لمدة ${penalty.duration} أيام\n\n⚠️ استمرار المخالفات سيؤدي إلى حظر دائم`,
        permanent_ban: `🚫 حظر دائم\n\n❌ تم حظرك بشكل دائم من البوت\n\n📞 للاستئناف، تواصل مع الدعم`
      },
      en: {
        warning: `⚠️ First Warning\n\n💡 Please follow bot rules to avoid penalties\n\n⚠️ Continued violations will result in restrictions and ban`,
        restriction: `⚠️ Second Warning + Restriction\n\n🚫 You are restricted from creating tasks for 24 hours\n\n💡 Continued violations will result in temporary ban`,
        temp_ban: `🚫 Temporary Ban\n\n⏰ You are banned for ${penalty.duration} days\n\n⚠️ Continued violations will result in permanent ban`,
        permanent_ban: `🚫 Permanent Ban\n\n❌ You are permanently banned from the bot\n\n📞 To appeal, contact support`
      },
      ru: {
        warning: `⚠️ Первое предупреждение\n\n💡 Пожалуйста, соблюдайте правила бота, чтобы избежать наказаний\n\n⚠️ Продолжение нарушений приведет к ограничениям и блокировке`,
        restriction: `⚠️ Второе предупреждение + ограничение\n\n🚫 Вам запрещено создавать задачи на 24 часа\n\n💡 Продолжение нарушений приведет к временной блокировке`,
        temp_ban: `🚫 Временная блокировка\n\n⏰ Вы заблокированы на ${penalty.duration} дней\n\n⚠️ Продолжение нарушений приведет к постоянной блокировке`,
        permanent_ban: `🚫 Постоянная блокировка\n\n❌ Вы навсегда заблокированы в боте\n\n📞 Для обжалования свяжитесь с поддержкой`
      }
    };
    
    return messages[lang]?.[penalty.action] || messages.ar[penalty.action];
  }

  /**
   * الحصول على رسالة الحظر
   */
  static getBanMessage(banStatus, remaining, lang = 'ar') {
    if (banStatus === 'permanent') {
      const messages = {
        ar: '🚫 عذراً، تم حظرك بشكل دائم من البوت\n\n📞 للاستئناف، تواصل مع الدعم',
        en: '🚫 Sorry, you are permanently banned from the bot\n\n📞 To appeal, contact support',
        ru: '🚫 Извините, вы навсегда заблокированы в боте\n\n📞 Для обжалования свяжитесь с поддержкой'
      };
      return messages[lang] || messages.ar;
    }
    
    if (banStatus === 'temporary' && remaining) {
      const timeStr = Ban.formatRemainingTime(remaining, lang);
      const messages = {
        ar: `🚫 عذراً، تم حظرك مؤقتاً\n\n⏰ الوقت المتبقي: ${timeStr}\n\n💡 يمكنك استخدام البوت بعد انتهاء المدة`,
        en: `🚫 Sorry, you are temporarily banned\n\n⏰ Time remaining: ${timeStr}\n\n💡 You can use the bot after the ban expires`,
        ru: `🚫 Извините, вы временно заблокированы\n\n⏰ Осталось времени: ${timeStr}\n\n💡 Вы сможете использовать бота после истечения срока`
      };
      return messages[lang] || messages.ar;
    }
    
    return null;
  }
}
