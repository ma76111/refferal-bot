import db from '../database.js';
import { logInfo, logSuccess, logError, logDatabase } from '../utils/logger.js';

export default class Appeal {
  // إنشاء استئناف جديد
  static create(userId, banId, reason) {
    return new Promise((resolve, reject) => {
      logInfo('APPEAL', `Creating appeal for user ${userId}`);
      
      db.run(
        `INSERT INTO appeals (user_id, ban_id, reason, status)
         VALUES (?, ?, ?, 'pending')`,
        [userId, banId, reason],
        function(err) {
          if (err) {
            logError('APPEAL', 'Failed to create appeal', err);
            reject(err);
          } else {
            logSuccess('APPEAL', `Appeal created with ID: ${this.lastID}`);
            logDatabase('INSERT', 'appeals', { id: this.lastID, userId });
            resolve(this.lastID);
          }
        }
      );
    });
  }

  // الحصول على استئناف
  static getById(appealId) {
    return new Promise((resolve, reject) => {
      logInfo('APPEAL', `Getting appeal ${appealId}`);
      
      db.get(
        `SELECT 
          a.*,
          u.telegram_id as user_telegram_id,
          u.username as user_username,
          b.reason as ban_reason,
          b.type as ban_type
         FROM appeals a
         JOIN users u ON a.user_id = u.id
         LEFT JOIN bans b ON a.ban_id = b.id
         WHERE a.id = ?`,
        [appealId],
        (err, row) => {
          if (err) {
            logError('APPEAL', 'Failed to get appeal', err);
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  }

  // التحقق من وجود استئناف معلق
  static checkPendingAppeal(userId) {
    return new Promise((resolve, reject) => {
      logInfo('APPEAL', `Checking pending appeal for user ${userId}`);
      
      db.get(
        "SELECT id FROM appeals WHERE user_id = ? AND status = 'pending'",
        [userId],
        (err, row) => {
          if (err) {
            logError('APPEAL', 'Failed to check pending appeal', err);
            reject(err);
          } else {
            resolve(!!row);
          }
        }
      );
    });
  }

  // تحديث حالة الاستئناف
  static updateStatus(appealId, status, reviewerId = null, reviewNote = null) {
    return new Promise((resolve, reject) => {
      logInfo('APPEAL', `Updating appeal ${appealId} status to ${status}`);
      
      db.run(
        `UPDATE appeals 
         SET status = ?, reviewer_id = ?, review_note = ?, reviewed_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [status, reviewerId, reviewNote, appealId],
        function(err) {
          if (err) {
            logError('APPEAL', 'Failed to update appeal status', err);
            reject(err);
          } else {
            logSuccess('APPEAL', `Appeal ${appealId} ${status}`);
            logDatabase('UPDATE', 'appeals', { id: appealId, status });
            resolve(this.changes);
          }
        }
      );
    });
  }

  // الحصول على جميع الاستئنافات المعلقة
  static getPending() {
    return new Promise((resolve, reject) => {
      logInfo('APPEAL', 'Getting pending appeals');
      
      db.all(
        `SELECT 
          a.*,
          u.telegram_id as user_telegram_id,
          u.username as user_username,
          b.reason as ban_reason,
          b.type as ban_type
         FROM appeals a
         JOIN users u ON a.user_id = u.id
         LEFT JOIN bans b ON a.ban_id = b.id
         WHERE a.status = 'pending'
         ORDER BY a.created_at ASC`,
        (err, rows) => {
          if (err) {
            logError('APPEAL', 'Failed to get pending appeals', err);
            reject(err);
          } else {
            logSuccess('APPEAL', `Found ${rows.length} pending appeals`);
            resolve(rows);
          }
        }
      );
    });
  }

  // الحصول على استئنافات المستخدم
  static getUserAppeals(userId) {
    return new Promise((resolve, reject) => {
      logInfo('APPEAL', `Getting appeals for user ${userId}`);
      
      db.all(
        `SELECT 
          a.*,
          u.username as reviewer_username
         FROM appeals a
         LEFT JOIN users u ON a.reviewer_id = u.id
         WHERE a.user_id = ?
         ORDER BY a.created_at DESC`,
        [userId],
        (err, rows) => {
          if (err) {
            logError('APPEAL', 'Failed to get user appeals', err);
            reject(err);
          } else {
            logSuccess('APPEAL', `Found ${rows.length} appeals`);
            resolve(rows);
          }
        }
      );
    });
  }

  // إحصائيات الاستئنافات
  static getStats() {
    return new Promise((resolve, reject) => {
      logInfo('APPEAL', 'Getting appeal statistics');
      
      db.get(
        `SELECT 
          COUNT(*) as total_appeals,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
         FROM appeals`,
        (err, row) => {
          if (err) {
            logError('APPEAL', 'Failed to get appeal stats', err);
            reject(err);
          } else {
            logSuccess('APPEAL', 'Appeal stats retrieved');
            resolve(row);
          }
        }
      );
    });
  }

  // حذف استئناف
  static delete(appealId) {
    return new Promise((resolve, reject) => {
      logInfo('APPEAL', `Deleting appeal ${appealId}`);
      
      db.run(
        'DELETE FROM appeals WHERE id = ?',
        [appealId],
        function(err) {
          if (err) {
            logError('APPEAL', 'Failed to delete appeal', err);
            reject(err);
          } else {
            logSuccess('APPEAL', `Appeal ${appealId} deleted`);
            logDatabase('DELETE', 'appeals', { id: appealId });
            resolve(this.changes);
          }
        }
      );
    });
  }
}
