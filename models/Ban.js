import db from '../database.js';
import logger from '../utils/logger.js';

export default class Ban {
  // إنشاء حظر جديد
  static create(banData) {
    return new Promise((resolve, reject) => {
      const { userId, type, duration, reason, bannedBy } = banData;
      
      logger.database(`Creating ban: user=${userId}, type=${type}, duration=${duration}`);
      
      const endDate = type === 'temporary' && duration 
        ? `datetime('now', '+${duration} days')` 
        : null;
      
      db.run(
        `INSERT INTO bans (user_id, type, duration, reason, banned_by, end_date)
         VALUES (?, ?, ?, ?, ?, ${endDate ? endDate : 'NULL'})`,
        [userId, type, duration, reason, bannedBy],
        function(err) {
          if (err) {
            logger.error(`Failed to create ban: ${err.message}`);
            reject(err);
          } else {
            logger.success(`Ban created with ID: ${this.lastID}`);
            resolve(this.lastID);
          }
        }
      );
    });
  }

  // الحصول على الحظر النشط للمستخدم
  static getActiveBan(userId) {
    return new Promise((resolve, reject) => {
      logger.database(`Getting active ban for user ${userId}`);
      
      db.get(
        `SELECT * FROM bans 
         WHERE user_id = ? AND status = 'active'
         AND (end_date IS NULL OR datetime(end_date) > datetime('now'))
         ORDER BY created_at DESC LIMIT 1`,
        [userId],
        (err, row) => {
          if (err) {
            logger.error(`Failed to get active ban: ${err.message}`);
            reject(err);
          } else {
            logger.info(`Active ban for user ${userId}: ${row ? 'found' : 'not found'}`);
            resolve(row);
          }
        }
      );
    });
  }

  // رفع الحظر المؤقت المنتهي
  static liftExpiredBans() {
    return new Promise((resolve, reject) => {
      logger.database('Lifting expired temporary bans');
      
      db.run(
        `UPDATE bans 
         SET status = 'expired' 
         WHERE status = 'active' 
         AND type = 'temporary'
         AND datetime(end_date) <= datetime('now')`,
        function(err) {
          if (err) {
            logger.error(`Failed to lift expired bans: ${err.message}`);
            reject(err);
          } else {
            logger.success(`Lifted ${this.changes} expired bans`);
            resolve(this.changes);
          }
        }
      );
    });
  }

  // إلغاء الحظر (للأدمن)
  static lift(banId, reviewerId) {
    return new Promise((resolve, reject) => {
      logger.database(`Lifting ban ${banId}`);
      
      db.run(
        `UPDATE bans SET status = 'lifted' WHERE id = ?`,
        [banId],
        (err) => {
          if (err) {
            logger.error(`Failed to lift ban: ${err.message}`);
            reject(err);
          } else {
            logger.success(`Ban ${banId} lifted by ${reviewerId}`);
            resolve();
          }
        }
      );
    });
  }

  // الحصول على جميع حظر المستخدم
  static getUserBans(userId) {
    return new Promise((resolve, reject) => {
      logger.database(`Getting bans for user ${userId}`);
      
      db.all(
        `SELECT * FROM bans 
         WHERE user_id = ? 
         ORDER BY created_at DESC`,
        [userId],
        (err, rows) => {
          if (err) {
            logger.error(`Failed to get bans: ${err.message}`);
            reject(err);
          } else {
            logger.info(`Found ${rows?.length || 0} bans for user ${userId}`);
            resolve(rows || []);
          }
        }
      );
    });
  }

  // الحصول على الوقت المتبقي للحظر
  static getRemainingTime(ban) {
    if (!ban || ban.type === 'permanent') {
      return null;
    }
    
    const now = new Date();
    const endDate = new Date(ban.end_date);
    const remaining = endDate - now;
    
    if (remaining <= 0) {
      return 0;
    }
    
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    return { days, hours, minutes, total: remaining };
  }

  // تنسيق الوقت المتبقي
  static formatRemainingTime(remaining, lang = 'ar') {
    if (!remaining || remaining.total <= 0) {
      return null;
    }
    
    const texts = {
      ar: {
        days: 'يوم',
        hours: 'ساعة',
        minutes: 'دقيقة'
      },
      en: {
        days: 'day',
        hours: 'hour',
        minutes: 'minute'
      },
      ru: {
        days: 'день',
        hours: 'час',
        minutes: 'минута'
      }
    };
    
    const t = texts[lang] || texts.ar;
    const parts = [];
    
    if (remaining.days > 0) {
      parts.push(`${remaining.days} ${t.days}`);
    }
    if (remaining.hours > 0) {
      parts.push(`${remaining.hours} ${t.hours}`);
    }
    if (remaining.minutes > 0 && remaining.days === 0) {
      parts.push(`${remaining.minutes} ${t.minutes}`);
    }
    
    return parts.join(' ');
  }
}
