import db from '../database.js';

/** أنواع الإشعارات المدعومة */
export const NOTIFICATION_TYPES = {
  SUBMISSION_ACCEPTED:  'submission_accepted',
  SUBMISSION_REJECTED:  'submission_rejected',
  TASK_COMPLETED:       'task_completed',
  PROMOTIONAL:          'promotional',
  SYSTEM_UPDATE:        'system_update',
  TICKET_REPLY:         'ticket_reply',
  DEPOSIT_COMPLETED:    'deposit_completed',
  WITHDRAWAL_COMPLETED: 'withdrawal_completed',
};

/** الأعمدة المقابلة في جدول notification_prefs */
const TYPE_TO_COLUMN = {
  [NOTIFICATION_TYPES.SUBMISSION_ACCEPTED]:  'submission_accepted',
  [NOTIFICATION_TYPES.SUBMISSION_REJECTED]:  'submission_rejected',
  [NOTIFICATION_TYPES.TASK_COMPLETED]:       'task_completed',
  [NOTIFICATION_TYPES.PROMOTIONAL]:          'promotional',
  [NOTIFICATION_TYPES.SYSTEM_UPDATE]:        'system_update',
  // ticket_reply / deposit_completed / withdrawal_completed → system_update كـ fallback
};

export default class NotificationPrefs {
  /**
   * جلب تفضيلات الإشعارات للمستخدم
   * @param {number} userId
   * @returns {Promise<object>}
   */
  static getPrefs(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM notification_prefs WHERE user_id = ?',
        [userId],
        (err, row) => {
          if (err) return reject(err);
          if (!row) {
            // الإعدادات الافتراضية: كل شيء مفعّل
            resolve({
              submission_accepted: 1,
              submission_rejected: 1,
              task_completed: 1,
              promotional: 1,
              system_update: 1,
            });
          } else {
            resolve({
              submission_accepted: row.submission_accepted,
              submission_rejected: row.submission_rejected,
              task_completed: row.task_completed,
              promotional: row.promotional,
              system_update: row.system_update,
            });
          }
        }
      );
    });
  }

  /**
   * حفظ تفضيلات الإشعارات للمستخدم
   * @param {number} userId
   * @param {object} prefs - { submission_accepted, submission_rejected, task_completed, promotional, system_update }
   * @returns {Promise<void>}
   */
  static savePrefs(userId, prefs) {
    return new Promise((resolve, reject) => {
      const {
        submission_accepted = 1,
        submission_rejected = 1,
        task_completed = 1,
        promotional = 1,
        system_update = 1,
      } = prefs;

      db.run(
        `INSERT INTO notification_prefs
          (user_id, submission_accepted, submission_rejected, task_completed, promotional, system_update, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET
           submission_accepted = excluded.submission_accepted,
           submission_rejected = excluded.submission_rejected,
           task_completed      = excluded.task_completed,
           promotional         = excluded.promotional,
           system_update       = excluded.system_update,
           updated_at          = CURRENT_TIMESTAMP`,
        [userId, submission_accepted ? 1 : 0, submission_rejected ? 1 : 0,
         task_completed ? 1 : 0, promotional ? 1 : 0, system_update ? 1 : 0],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * التحقق من تفعيل نوع إشعار معين للمستخدم
   * @param {number} userId
   * @param {string} type - أحد قيم NOTIFICATION_TYPES
   * @returns {Promise<boolean>}
   */
  static async isEnabled(userId, type) {
    const prefs = await this.getPrefs(userId);
    const column = TYPE_TO_COLUMN[type] || 'system_update';
    return prefs[column] === 1;
  }
}
