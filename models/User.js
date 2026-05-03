import db from '../database.js';

export default class User {
  static create(telegramId, username) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT OR IGNORE INTO users (telegram_id, username) VALUES (?, ?)',
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
      // إزالة @ من اليوزرنيم إذا كان موجوداً
      const cleanQuery = query.toString().replace('@', '');
      const numericQuery = parseInt(cleanQuery);
      
      // إذا كان الإدخال رقمياً، ابحث بـ telegram_id فقط
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
        // إذا كان نصياً، ابحث بـ username فقط
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

  static updateBalance(userId, amount) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET balance = balance + ? WHERE id = ?',
        [amount, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
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

  // نقاط الإحالات المتبادلة
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

  static updateExchangePoints(userId, points) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET exchange_points = exchange_points + ? WHERE id = ?',
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
}
