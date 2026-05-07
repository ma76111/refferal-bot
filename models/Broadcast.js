import db from '../database.js';
import { logInfo, logSuccess, logError, logDatabase } from '../utils/logger.js';

export default class Broadcast {
  // إنشاء رسالة جماعية
  static create(adminId, message, targetType = 'all', targetIds = null) {
    return new Promise((resolve, reject) => {
      logInfo('BROADCAST', `Creating broadcast message by admin ${adminId}`);
      
      db.run(
        `INSERT INTO broadcasts (admin_id, message, target_type, target_ids, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [adminId, message, targetType, targetIds ? JSON.stringify(targetIds) : null],
        function(err) {
          if (err) {
            logError('BROADCAST', 'Failed to create broadcast', err);
            reject(err);
          } else {
            logSuccess('BROADCAST', `Broadcast created with ID: ${this.lastID}`);
            logDatabase('INSERT', 'broadcasts', { id: this.lastID });
            resolve(this.lastID);
          }
        }
      );
    });
  }

  // الحصول على رسالة جماعية
  static getById(broadcastId) {
    return new Promise((resolve, reject) => {
      logInfo('BROADCAST', `Getting broadcast ${broadcastId}`);
      
      db.get(
        'SELECT * FROM broadcasts WHERE id = ?',
        [broadcastId],
        (err, row) => {
          if (err) {
            logError('BROADCAST', 'Failed to get broadcast', err);
            reject(err);
          } else {
            if (row && row.target_ids) {
              row.target_ids = JSON.parse(row.target_ids);
            }
            resolve(row);
          }
        }
      );
    });
  }

  // تحديث حالة الرسالة
  static updateStatus(broadcastId, status, sentCount = null, failedCount = null) {
    return new Promise((resolve, reject) => {
      logInfo('BROADCAST', `Updating broadcast ${broadcastId} status to ${status}`);
      
      let query = 'UPDATE broadcasts SET status = ?';
      let params = [status];
      
      if (sentCount !== null) {
        query += ', sent_count = ?';
        params.push(sentCount);
      }
      
      if (failedCount !== null) {
        query += ', failed_count = ?';
        params.push(failedCount);
      }
      
      if (status === 'completed' || status === 'failed') {
        query += ', completed_at = CURRENT_TIMESTAMP';
      }
      
      query += ' WHERE id = ?';
      params.push(broadcastId);
      
      db.run(query, params, function(err) {
        if (err) {
          logError('BROADCAST', 'Failed to update broadcast status', err);
          reject(err);
        } else {
          logSuccess('BROADCAST', `Broadcast ${broadcastId} status updated`);
          logDatabase('UPDATE', 'broadcasts', { id: broadcastId, status });
          resolve(this.changes);
        }
      });
    });
  }

  // الحصول على جميع الرسائل الجماعية
  static getAll(limit = 50) {
    return new Promise((resolve, reject) => {
      logInfo('BROADCAST', 'Getting all broadcasts');
      
      db.all(
        `SELECT 
          b.*,
          u.username as admin_username
         FROM broadcasts b
         JOIN users u ON b.admin_id = u.id
         ORDER BY b.created_at DESC
         LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) {
            logError('BROADCAST', 'Failed to get broadcasts', err);
            reject(err);
          } else {
            rows.forEach(row => {
              if (row.target_ids) {
                row.target_ids = JSON.parse(row.target_ids);
              }
            });
            logSuccess('BROADCAST', `Found ${rows.length} broadcasts`);
            resolve(rows);
          }
        }
      );
    });
  }

  // الحصول على الرسائل المعلقة
  static getPending() {
    return new Promise((resolve, reject) => {
      logInfo('BROADCAST', 'Getting pending broadcasts');
      
      db.all(
        "SELECT * FROM broadcasts WHERE status = 'pending' ORDER BY created_at ASC",
        (err, rows) => {
          if (err) {
            logError('BROADCAST', 'Failed to get pending broadcasts', err);
            reject(err);
          } else {
            rows.forEach(row => {
              if (row.target_ids) {
                row.target_ids = JSON.parse(row.target_ids);
              }
            });
            logSuccess('BROADCAST', `Found ${rows.length} pending broadcasts`);
            resolve(rows);
          }
        }
      );
    });
  }

  // حذف رسالة جماعية
  static delete(broadcastId) {
    return new Promise((resolve, reject) => {
      logInfo('BROADCAST', `Deleting broadcast ${broadcastId}`);
      
      db.run(
        'DELETE FROM broadcasts WHERE id = ?',
        [broadcastId],
        function(err) {
          if (err) {
            logError('BROADCAST', 'Failed to delete broadcast', err);
            reject(err);
          } else {
            logSuccess('BROADCAST', `Broadcast ${broadcastId} deleted`);
            logDatabase('DELETE', 'broadcasts', { id: broadcastId });
            resolve(this.changes);
          }
        }
      );
    });
  }

  // إحصائيات الرسائل الجماعية
  static getStats() {
    return new Promise((resolve, reject) => {
      logInfo('BROADCAST', 'Getting broadcast statistics');
      
      db.get(
        `SELECT 
          COUNT(*) as total_broadcasts,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'sending' THEN 1 END) as sending,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          SUM(sent_count) as total_sent,
          SUM(failed_count) as total_failed
         FROM broadcasts`,
        (err, row) => {
          if (err) {
            logError('BROADCAST', 'Failed to get broadcast stats', err);
            reject(err);
          } else {
            logSuccess('BROADCAST', 'Broadcast stats retrieved');
            resolve(row);
          }
        }
      );
    });
  }
}
