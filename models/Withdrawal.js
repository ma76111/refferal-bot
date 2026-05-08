import db from '../database.js';

class Withdrawal {
  static create({ userId, amount, method, binanceId, walletAddress, network, screenshotId }) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO withdrawals (user_id, amount, method, binance_id, wallet_address, network, screenshot_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, amount, method, binanceId, walletAddress, network, screenshotId],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  static getById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT w.*, u.telegram_id as user_telegram_id, u.username 
         FROM withdrawals w 
         JOIN users u ON w.user_id = u.id 
         WHERE w.id = ?`,
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  static getPending() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT w.*, u.telegram_id as user_telegram_id, u.username 
         FROM withdrawals w 
         JOIN users u ON w.user_id = u.id 
         WHERE w.status = 'pending'
         AND u.ban_status = 'none'
         ORDER BY w.created_at ASC`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  static updateStatus(id, status, reviewedBy, rejectReason = null) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE withdrawals 
         SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, reject_reason = ? 
         WHERE id = ?`,
        [status, reviewedBy, rejectReason, id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  static getUserWithdrawals(userId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }
}

export default Withdrawal;
