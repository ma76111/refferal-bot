import db from '../database.js';
import logger from '../utils/logger.js';

export default class Deposit {
  static create(depositData) {
    return new Promise((resolve, reject) => {
      const { userId, amount, method, binanceId, txid, screenshotId, transferTime } = depositData;
      
      logger.database(`Creating deposit for user ${userId}: ${amount} USDT via ${method}`);
      
      db.run(
        `INSERT INTO deposits (user_id, amount, method, binance_id, txid, screenshot_id, transfer_time, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [userId, amount, method, binanceId || null, txid || null, screenshotId || null, transferTime || null],
        function(err) {
          if (err) {
            logger.error(`Failed to create deposit: ${err.message}`);
            reject(err);
          } else {
            logger.success(`Deposit created with ID: ${this.lastID} (${amount} USDT)`);
            resolve(this.lastID);
          }
        }
      );
    });
  }

  static getPending() {
    return new Promise((resolve, reject) => {
      logger.database('Fetching pending deposits');
      
      db.all(
        `SELECT d.*, u.username, u.telegram_id
         FROM deposits d
         JOIN users u ON d.user_id = u.id
         WHERE d.status = 'pending'
         AND u.ban_status = 'none'
         ORDER BY d.created_at ASC`,
        (err, rows) => {
          if (err) {
            logger.error(`Failed to fetch pending deposits: ${err.message}`);
            reject(err);
          } else {
            logger.info(`Found ${rows?.length || 0} pending deposits`);
            resolve(rows || []);
          }
        }
      );
    });
  }

  static getById(depositId) {
    return new Promise((resolve, reject) => {
      logger.database(`Fetching deposit by ID: ${depositId}`);
      
      db.get(
        `SELECT d.*, u.telegram_id as user_telegram_id
         FROM deposits d
         JOIN users u ON d.user_id = u.id
         WHERE d.id = ?`,
        [depositId],
        (err, row) => {
          if (err) {
            logger.error(`Failed to fetch deposit ${depositId}: ${err.message}`);
            reject(err);
          } else {
            logger.info(`Deposit ${depositId} ${row ? 'found' : 'not found'}`);
            resolve(row);
          }
        }
      );
    });
  }

  static updateStatus(depositId, status, reviewerId, rejectReason = null) {
    return new Promise((resolve, reject) => {
      logger.database(`Updating deposit ${depositId} status to: ${status}`);
      
      db.run(
        `UPDATE deposits 
         SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, reject_reason = ?
         WHERE id = ?`,
        [status, reviewerId, rejectReason, depositId],
        (err) => {
          if (err) {
            logger.error(`Failed to update deposit ${depositId}: ${err.message}`);
            reject(err);
          } else {
            logger.success(`Deposit ${depositId} status updated to ${status} by reviewer ${reviewerId}`);
            if (rejectReason) logger.info(`Reject reason: ${rejectReason}`);
            resolve();
          }
        }
      );
    });
  }

  static findByTxId(txid) {
    return new Promise((resolve, reject) => {
      logger.database(`Searching for deposit with TXID: ${txid}`);
      
      db.get(
        'SELECT * FROM deposits WHERE txid = ?',
        [txid],
        (err, row) => {
          if (err) {
            logger.error(`Failed to search deposit by TXID: ${err.message}`);
            reject(err);
          } else {
            logger.info(`Deposit with TXID ${txid} ${row ? 'found' : 'not found'}`);
            resolve(row);
          }
        }
      );
    });
  }
}
