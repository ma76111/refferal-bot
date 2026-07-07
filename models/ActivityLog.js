import db from '../database.js';

export default class ActivityLog {
  /**
   * تسجيل نشاط مستخدم
   * @param {number} userId
   * @param {string} eventType - login|task_created|submission|deposit|withdrawal|vote|ticket_reply
   * @param {object|string|null} metadata - يُخزَّن كـ JSON string
   * @returns {Promise<number>} معرف السجل الجديد
   */
  static log(userId, eventType, metadata = null) {
    return new Promise((resolve, reject) => {
      const metaStr = metadata
        ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata))
        : null;

      db.run(
        `INSERT INTO activity_log (user_id, event_type, metadata)
         VALUES (?, ?, ?)`,
        [userId, eventType, metaStr],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  /**
   * جلب سجل نشاط مستخدم مع pagination
   * @param {number} userId
   * @param {number} page - رقم الصفحة (يبدأ من 1)
   * @param {number} pageSize - حجم الصفحة
   * @returns {Promise<{ data: Array, total: number, page: number, pageSize: number }>}
   */
  static getUserActivity(userId, page = 1, pageSize = 20) {
    const offset = (Math.max(1, page) - 1) * Math.min(100, pageSize);
    const limit  = Math.min(100, pageSize);

    return new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as total FROM activity_log WHERE user_id = ?',
        [userId],
        (err, countRow) => {
          if (err) return reject(err);
          const total = countRow?.total ?? 0;

          db.all(
            `SELECT * FROM activity_log
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`,
            [userId, limit, offset],
            (err2, rows) => {
              if (err2) return reject(err2);
              resolve({
                data: rows || [],
                total,
                page: Math.max(1, page),
                pageSize: limit,
              });
            }
          );
        }
      );
    });
  }

  /**
   * جلب بيانات الرصيد على مدار X يوم الأخيرة (للـ chart)
   * @param {number} userId
   * @param {number} days
   * @returns {Promise<Array>}
   */
  static getBalanceHistory(userId, days = 30) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT
           date(created_at) as day,
           event_type,
           metadata
         FROM activity_log
         WHERE user_id = ?
           AND event_type IN ('deposit', 'withdrawal')
           AND created_at >= datetime('now', ? || ' days')
         ORDER BY created_at ASC`,
        [userId, `-${days}`],
        (err, rows) => {
          if (err) return reject(err);

          // تجميع حسب اليوم
          const byDay = {};
          for (const row of rows || []) {
            if (!byDay[row.day]) byDay[row.day] = { day: row.day, deposit: 0, withdrawal: 0 };
            try {
              const meta = JSON.parse(row.metadata || '{}');
              const amount = parseFloat(meta.amount || 0);
              if (row.event_type === 'deposit')    byDay[row.day].deposit    += amount;
              if (row.event_type === 'withdrawal') byDay[row.day].withdrawal += amount;
            } catch (_) { /* ignore parse errors */ }
          }

          resolve(Object.values(byDay));
        }
      );
    });
  }
}
