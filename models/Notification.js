import db from '../database.js';

/** انتهاء صلاحية الإشعارات بعد 30 يوماً */
const EXPIRY_DAYS = 30;

export default class Notification {
  /**
   * إنشاء إشعار جديد
   * @param {number} userId
   * @param {string} type
   * @param {string} title
   * @param {string|null} body
   * @param {string|null} link
   * @returns {Promise<number>} معرّف الإشعار الجديد
   */
  static create(userId, type, title, body = null, link = null) {
    return new Promise((resolve, reject) => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS);

      db.run(
        `INSERT INTO notifications (user_id, type, title, body, link, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, type, title, body, link, expiresAt.toISOString()],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  /**
   * جلب إشعارات المستخدم (الحديثة أولاً، غير منتهية الصلاحية)
   * @param {number} userId
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  static getUserNotifications(userId, limit = 50) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM notifications
         WHERE user_id = ?
           AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
         ORDER BY created_at DESC
         LIMIT ?`,
        [userId, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * تعليم إشعار محدد كمقروء
   * @param {number} id
   * @param {number} userId - للتحقق من الملكية
   * @returns {Promise<boolean>}
   */
  static markRead(id, userId) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
        [id, userId],
        function (err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }

  /**
   * تعليم جميع إشعارات المستخدم كمقروءة
   * @param {number} userId
   * @returns {Promise<void>}
   */
  static markAllRead(userId) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
        [userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * عدد الإشعارات غير المقروءة للمستخدم
   * @param {number} userId
   * @returns {Promise<number>}
   */
  static getUnreadCount(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) AS cnt FROM notifications
         WHERE user_id = ? AND is_read = 0
           AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row?.cnt ?? 0);
        }
      );
    });
  }

  /**
   * حذف الإشعارات المنتهية الصلاحية (يُشغَّل كـ cron job)
   * @returns {Promise<number>} عدد السجلات المحذوفة
   */
  static cleanExpired() {
    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM notifications WHERE expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP',
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }
}
