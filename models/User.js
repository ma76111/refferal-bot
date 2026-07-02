import db from '../database.js';

export default class User {
  static create(telegramId, username) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT OR IGNORE INTO users (telegram_id, username, exchange_points) VALUES (?, ?, 0)',
        [telegramId, username],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  static findByTelegramId(telegramId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM users WHERE telegram_id = ?',
        [telegramId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  static setLanguage(userId, language) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET language = ? WHERE id = ?',
        [language, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  static searchByIdOrUsername(query) {
    return new Promise((resolve, reject) => {
      const cleanQuery = query.toString().replace('@', '');
      const numericQuery = parseInt(cleanQuery);
      
      if (!isNaN(numericQuery) && numericQuery > 0) {
        db.all(
          'SELECT * FROM users WHERE telegram_id = ?',
          [numericQuery],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      } else {
        db.all(
          'SELECT * FROM users WHERE username LIKE ?',
          [`%${cleanQuery}%`],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      }
    });
  }

  /**
   * تحديث الرصيد بشكل آمن
   * يمنع الرصيد من أن يصبح سالباً إذا كان المبلغ المخصوم أكبر من المتاح
   */
  static updateBalance(userId, amount) {
    return new Promise((resolve, reject) => {
      // إذا كان الخصم سيجعل الرصيد سالباً، نرفض العملية
      const query = amount < 0 
        ? 'UPDATE users SET balance = balance + ? WHERE id = ? AND balance >= ?' 
        : 'UPDATE users SET balance = balance + ? WHERE id = ?';
      
      const params = amount < 0 ? [amount, userId, Math.abs(amount)] : [amount, userId];

      db.run(query, params, function(err) {
        if (err) {
          reject(err);
        } else if (this.changes === 0) {
          reject(new Error('INSUFFICIENT_BALANCE_OR_USER_NOT_FOUND'));
        } else {
          resolve();
        }
      });
    });
  }

  static getBalance(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT balance FROM users WHERE id = ?',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row?.balance || 0);
        }
      );
    });
  }

  static setBalance(userId, amount) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET balance = ? WHERE id = ?',
        [amount, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  static getExchangePoints(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT exchange_points FROM users WHERE id = ?',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row?.exchange_points || 0);
        }
      );
    });
  }

  /**
   * تحديث نقاط التبادل بشكل آمن
   */
  static updateExchangePoints(userId, points) {
    return new Promise((resolve, reject) => {
      const query = points < 0
        ? 'UPDATE users SET exchange_points = exchange_points + ? WHERE id = ? AND exchange_points >= ?'
        : 'UPDATE users SET exchange_points = exchange_points + ? WHERE id = ?';
      
      const params = points < 0 ? [points, userId, Math.abs(points)] : [points, userId];

      db.run(query, params, function(err) {
        if (err) {
          reject(err);
        } else if (this.changes === 0) {
          reject(new Error('INSUFFICIENT_POINTS_OR_USER_NOT_FOUND'));
        } else {
          resolve();
        }
      });
    });
  }

  static setExchangePoints(userId, points) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET exchange_points = ? WHERE id = ?',
        [points, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  static banUser(userId) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET is_banned = 1 WHERE id = ?',
        [userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  static unbanUser(userId) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET is_banned = 0 WHERE id = ?',
        [userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  static isBanned(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT is_banned FROM users WHERE id = ?',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row?.is_banned === 1);
        }
      );
    });
  }

  static findById(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM users WHERE id = ?',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  static addViolationPoints(userId, points) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE users 
         SET violation_points = violation_points + ?, 
             last_violation_date = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [points, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  static getViolationPoints(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT violation_points FROM users WHERE id = ?',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row?.violation_points || 0);
        }
      );
    });
  }

  static updateBanStatus(userId, status, expiresAt = null) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE users 
         SET ban_status = ?, 
             ban_expires_at = ?,
             is_banned = ? 
         WHERE id = ?`,
        [status, expiresAt, status !== 'none' ? 1 : 0, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  static getBanStatus(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT ban_status, ban_expires_at FROM users WHERE id = ?',
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  static addRestriction(userId, restriction) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT restrictions FROM users WHERE id = ?',
        [userId],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          
          let restrictions = [];
          if (row?.restrictions) {
            try {
              restrictions = JSON.parse(row.restrictions);
            } catch (e) {
              restrictions = [];
            }
          }
          
          if (!restrictions.includes(restriction)) {
            restrictions.push(restriction);
          }
          
          db.run(
            'UPDATE users SET restrictions = ? WHERE id = ?',
            [JSON.stringify(restrictions), userId],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        }
      );
    });
  }

  static removeRestriction(userId, restriction) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT restrictions FROM users WHERE id = ?',
        [userId],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          
          let restrictions = [];
          if (row?.restrictions) {
            try {
              restrictions = JSON.parse(row.restrictions);
            } catch (e) {
              restrictions = [];
            }
          }
          
          restrictions = restrictions.filter(r => r !== restriction);
          
          db.run(
            'UPDATE users SET restrictions = ? WHERE id = ?',
            [JSON.stringify(restrictions), userId],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        }
      );
    });
  }

  static getRestrictions(userId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT restrictions FROM users WHERE id = ?',
        [userId],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          
          let restrictions = [];
          if (row?.restrictions) {
            try {
              restrictions = JSON.parse(row.restrictions);
            } catch (e) {
              restrictions = [];
            }
          }
          
          resolve(restrictions);
        }
      );
    });
  }

  static hasRestriction(userId, restriction) {
    return new Promise(async (resolve, reject) => {
      try {
        const restrictions = await this.getRestrictions(userId);
        resolve(restrictions.includes(restriction));
      } catch (err) {
        reject(err);
      }
    });
  }

  static reduceViolationPoints(userId, points) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE users 
         SET violation_points = CASE 
           WHEN violation_points - ? < 0 THEN 0 
           ELSE violation_points - ? 
         END 
         WHERE id = ?`,
        [points, points, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  static getAll() {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM users ORDER BY created_at DESC',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  static getActive() {
    return new Promise((resolve, reject) => {
      db.all(
        "SELECT * FROM users WHERE ban_status = 'none' ORDER BY created_at DESC",
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  static getBanned() {
    return new Promise((resolve, reject) => {
      db.all(
        "SELECT * FROM users WHERE ban_status != 'none' ORDER BY created_at DESC",
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }
}
