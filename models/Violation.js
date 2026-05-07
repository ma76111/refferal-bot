import db from '../database.js';
import logger from '../utils/logger.js';

// أنواع المخالفات ونقاطها
export const VIOLATION_TYPES = {
  REPORT_RECEIVED: { points: 1, name: 'report_received' },
  SUBMISSION_REJECTED: { points: 2, name: 'submission_rejected' },
  SPAM_REPORTS: { points: 3, name: 'spam_reports' },
  FRAUD_ATTEMPT: { points: 5, name: 'fraud_attempt' },
  ABUSIVE_BEHAVIOR: { points: 3, name: 'abusive_behavior' },
  FAKE_TASK: { points: 4, name: 'fake_task' },
  MULTIPLE_ACCOUNTS: { points: 10, name: 'multiple_accounts' }
};

// مستويات العقوبات
export const PENALTY_LEVELS = {
  WARNING_1: { min: 3, max: 4, action: 'warning' },
  WARNING_2: { min: 5, max: 7, action: 'restriction' },
  TEMP_BAN_3: { min: 8, max: 10, action: 'temp_ban', duration: 3 },
  TEMP_BAN_7: { min: 11, max: 14, action: 'temp_ban', duration: 7 },
  PERMANENT_BAN: { min: 15, max: 999, action: 'permanent_ban' }
};

export default class Violation {
  // إضافة مخالفة جديدة
  static create(violationData) {
    return new Promise((resolve, reject) => {
      const { userId, type, points, reason, expiresAt } = violationData;
      
      logger.database(`Creating violation: user=${userId}, type=${type}, points=${points}`);
      
      db.run(
        `INSERT INTO violations (user_id, type, points, reason, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, type, points, reason, expiresAt],
        function(err) {
          if (err) {
            logger.error(`Failed to create violation: ${err.message}`);
            reject(err);
          } else {
            logger.success(`Violation created with ID: ${this.lastID}`);
            resolve(this.lastID);
          }
        }
      );
    });
  }

  // الحصول على مجموع نقاط المخالفات النشطة للمستخدم
  static getUserViolationPoints(userId) {
    return new Promise((resolve, reject) => {
      logger.database(`Getting violation points for user ${userId}`);
      
      db.get(
        `SELECT SUM(points) as total_points 
         FROM violations 
         WHERE user_id = ? AND status = 'active'
         AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))`,
        [userId],
        (err, row) => {
          if (err) {
            logger.error(`Failed to get violation points: ${err.message}`);
            reject(err);
          } else {
            const points = row?.total_points || 0;
            logger.info(`User ${userId} has ${points} violation points`);
            resolve(points);
          }
        }
      );
    });
  }

  // الحصول على جميع مخالفات المستخدم
  static getUserViolations(userId) {
    return new Promise((resolve, reject) => {
      logger.database(`Getting violations for user ${userId}`);
      
      db.all(
        `SELECT * FROM violations 
         WHERE user_id = ? 
         ORDER BY created_at DESC`,
        [userId],
        (err, rows) => {
          if (err) {
            logger.error(`Failed to get violations: ${err.message}`);
            reject(err);
          } else {
            logger.info(`Found ${rows?.length || 0} violations for user ${userId}`);
            resolve(rows || []);
          }
        }
      );
    });
  }

  // إلغاء المخالفات المنتهية
  static expireOldViolations() {
    return new Promise((resolve, reject) => {
      logger.database('Expiring old violations');
      
      db.run(
        `UPDATE violations 
         SET status = 'expired' 
         WHERE status = 'active' 
         AND expires_at IS NOT NULL 
         AND datetime(expires_at) <= datetime('now')`,
        function(err) {
          if (err) {
            logger.error(`Failed to expire violations: ${err.message}`);
            reject(err);
          } else {
            logger.success(`Expired ${this.changes} violations`);
            resolve(this.changes);
          }
        }
      );
    });
  }

  // تقليل النقاط تلقائياً (إعادة التأهيل)
  static rehabilitateUsers() {
    return new Promise((resolve, reject) => {
      logger.database('Rehabilitating users (reducing points)');
      
      // تقليل نقطة واحدة للمستخدمين الذين لم يرتكبوا مخالفات منذ 30 يوم
      db.run(
        `UPDATE users 
         SET violation_points = CASE 
           WHEN violation_points > 0 THEN violation_points - 1 
           ELSE 0 
         END
         WHERE (last_violation_date IS NULL 
         OR datetime(last_violation_date) <= datetime('now', '-30 days'))
         AND violation_points > 0`,
        function(err) {
          if (err) {
            logger.error(`Failed to rehabilitate users: ${err.message}`);
            reject(err);
          } else {
            logger.success(`Rehabilitated ${this.changes} users`);
            resolve(this.changes);
          }
        }
      );
    });
  }

  // حذف مخالفة (للأدمن فقط)
  static remove(violationId) {
    return new Promise((resolve, reject) => {
      logger.database(`Removing violation ${violationId}`);
      
      db.run(
        `UPDATE violations SET status = 'removed' WHERE id = ?`,
        [violationId],
        (err) => {
          if (err) {
            logger.error(`Failed to remove violation: ${err.message}`);
            reject(err);
          } else {
            logger.success(`Violation ${violationId} removed`);
            resolve();
          }
        }
      );
    });
  }

  // تحديد مستوى العقوبة بناءً على النقاط
  static getPenaltyLevel(points) {
    for (const [level, config] of Object.entries(PENALTY_LEVELS)) {
      if (points >= config.min && points <= config.max) {
        return { level, ...config };
      }
    }
    return null;
  }

  // الحصول على وصف المخالفة
  static getViolationDescription(type, lang = 'ar') {
    const descriptions = {
      ar: {
        report_received: 'تلقي إبلاغ من مستخدم آخر',
        submission_rejected: 'رفض إثبات بشكل نهائي',
        spam_reports: 'إرسال إبلاغات متكررة (سبام)',
        fraud_attempt: 'محاولة احتيال',
        abusive_behavior: 'سلوك مسيء',
        fake_task: 'إنشاء مهمة وهمية',
        multiple_accounts: 'استخدام حسابات متعددة'
      },
      en: {
        report_received: 'Received report from another user',
        submission_rejected: 'Submission rejected permanently',
        spam_reports: 'Sending repeated reports (spam)',
        fraud_attempt: 'Fraud attempt',
        abusive_behavior: 'Abusive behavior',
        fake_task: 'Creating fake task',
        multiple_accounts: 'Using multiple accounts'
      },
      ru: {
        report_received: 'Получена жалоба от другого пользователя',
        submission_rejected: 'Заявка окончательно отклонена',
        spam_reports: 'Отправка повторных жалоб (спам)',
        fraud_attempt: 'Попытка мошенничества',
        abusive_behavior: 'Оскорбительное поведение',
        fake_task: 'Создание фальшивой задачи',
        multiple_accounts: 'Использование нескольких аккаунтов'
      }
    };
    
    return descriptions[lang]?.[type] || type;
  }
}
