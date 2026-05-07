import db from '../database.js';
import logger from '../utils/logger.js';

// أنواع التقييدات
export const RESTRICTION_TYPES = {
  NO_TASK_CREATION: 'no_task_creation',
  NO_WITHDRAWAL: 'no_withdrawal',
  NO_REPORTING: 'no_reporting',
  REDUCED_TASK_LIMIT: 'reduced_task_limit',
  INCREASED_COOLDOWN: 'increased_cooldown'
};

export default class Restriction {
  // إضافة تقييد جديد
  static create(restrictionData) {
    return new Promise((resolve, reject) => {
      const { userId, type, duration, reason } = restrictionData;
      
      logger.database(`Creating restriction: user=${userId}, type=${type}, duration=${duration}`);
      
      const endDate = duration ? `datetime('now', '+${duration} hours')` : null;
      
      db.run(
        `INSERT INTO restrictions (user_id, type, duration, end_date, reason)
         VALUES (?, ?, ?, ${endDate ? endDate : 'NULL'}, ?)`,
        [userId, type, duration, reason],
        function(err) {
          if (err) {
            logger.error(`Failed to create restriction: ${err.message}`);
            reject(err);
          } else {
            logger.success(`Restriction created with ID: ${this.lastID}`);
            resolve(this.lastID);
          }
        }
      );
    });
  }

  // الحصول على التقييدات النشطة للمستخدم
  static getActiveRestrictions(userId) {
    return new Promise((resolve, reject) => {
      logger.database(`Getting active restrictions for user ${userId}`);
      
      db.all(
        `SELECT * FROM restrictions 
         WHERE user_id = ? AND status = 'active'
         AND (end_date IS NULL OR datetime(end_date) > datetime('now'))`,
        [userId],
        (err, rows) => {
          if (err) {
            logger.error(`Failed to get restrictions: ${err.message}`);
            reject(err);
          } else {
            logger.info(`Found ${rows?.length || 0} active restrictions for user ${userId}`);
            resolve(rows || []);
          }
        }
      );
    });
  }

  // التحقق من وجود تقييد معين
  static hasRestriction(userId, type) {
    return new Promise((resolve, reject) => {
      logger.database(`Checking restriction ${type} for user ${userId}`);
      
      db.get(
        `SELECT id FROM restrictions 
         WHERE user_id = ? AND type = ? AND status = 'active'
         AND (end_date IS NULL OR datetime(end_date) > datetime('now'))`,
        [userId, type],
        (err, row) => {
          if (err) {
            logger.error(`Failed to check restriction: ${err.message}`);
            reject(err);
          } else {
            const hasRestriction = !!row;
            logger.info(`User ${userId} ${hasRestriction ? 'has' : 'does not have'} restriction ${type}`);
            resolve(hasRestriction);
          }
        }
      );
    });
  }

  // رفع التقييدات المنتهية
  static liftExpiredRestrictions() {
    return new Promise((resolve, reject) => {
      logger.database('Lifting expired restrictions');
      
      db.run(
        `UPDATE restrictions 
         SET status = 'expired' 
         WHERE status = 'active' 
         AND datetime(end_date) <= datetime('now')`,
        function(err) {
          if (err) {
            logger.error(`Failed to lift expired restrictions: ${err.message}`);
            reject(err);
          } else {
            logger.success(`Lifted ${this.changes} expired restrictions`);
            resolve(this.changes);
          }
        }
      );
    });
  }

  // إلغاء تقييد (للأدمن)
  static remove(restrictionId) {
    return new Promise((resolve, reject) => {
      logger.database(`Removing restriction ${restrictionId}`);
      
      db.run(
        `UPDATE restrictions SET status = 'removed' WHERE id = ?`,
        [restrictionId],
        (err) => {
          if (err) {
            logger.error(`Failed to remove restriction: ${err.message}`);
            reject(err);
          } else {
            logger.success(`Restriction ${restrictionId} removed`);
            resolve();
          }
        }
      );
    });
  }

  // الحصول على وصف التقييد
  static getRestrictionDescription(type, lang = 'ar') {
    const descriptions = {
      ar: {
        no_task_creation: 'منع إضافة مهام جديدة',
        no_withdrawal: 'منع السحب',
        no_reporting: 'منع الإبلاغ',
        reduced_task_limit: 'تقليل عدد المهام المسموح بها',
        increased_cooldown: 'زيادة وقت الانتظار بين المهام'
      },
      en: {
        no_task_creation: 'Cannot create new tasks',
        no_withdrawal: 'Cannot withdraw',
        no_reporting: 'Cannot report',
        reduced_task_limit: 'Reduced task limit',
        increased_cooldown: 'Increased cooldown between tasks'
      },
      ru: {
        no_task_creation: 'Нельзя создавать новые задачи',
        no_withdrawal: 'Нельзя выводить средства',
        no_reporting: 'Нельзя жаловаться',
        reduced_task_limit: 'Уменьшенный лимит задач',
        increased_cooldown: 'Увеличенное время ожидания между задачами'
      }
    };
    
    return descriptions[lang]?.[type] || type;
  }
}
