import db from '../database.js';
import crypto from 'crypto';

const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const VALID_STATUSES   = ['open', 'in_progress', 'closed'];

/**
 * توليد رقم تذكرة فريد بصيغة TKT-XXXXXXXX
 * @returns {string}
 */
function generateTicketNo() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let suffix = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    suffix += chars[bytes[i] % chars.length];
  }
  return `TKT-${suffix}`;
}

export default class Ticket {
  /**
   * إنشاء تذكرة جديدة
   * @param {number} userId
   * @param {string} subject
   * @param {string} priority - low|medium|high|urgent
   * @returns {Promise<{ id: number, ticket_no: string }>}
   */
  static create(userId, subject, priority = 'medium') {
    const prio = VALID_PRIORITIES.includes(priority) ? priority : 'medium';

    return new Promise(async (resolve, reject) => {
      // نحاول حتى 5 مرات لضمان فريدية ticket_no
      for (let attempt = 0; attempt < 5; attempt++) {
        const ticketNo = generateTicketNo();
        try {
          const id = await new Promise((res2, rej2) => {
            db.run(
              `INSERT INTO tickets (ticket_no, user_id, subject, priority)
               VALUES (?, ?, ?, ?)`,
              [ticketNo, userId, subject, prio],
              function(err) {
                if (err) rej2(err);
                else res2(this.lastID);
              }
            );
          });
          return resolve({ id, ticket_no: ticketNo });
        } catch (err) {
          // SQLITE_CONSTRAINT = تعارض في ticket_no، نحاول مجدداً
          if (attempt < 4) continue;
          reject(err);
        }
      }
    });
  }

  /**
   * جلب تذكرة بمعرّفها
   * @param {number} id
   * @returns {Promise<object|null>}
   */
  static getById(id) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT t.*, u.username as user_username,
                a.username as assigned_username
         FROM tickets t
         JOIN users u ON t.user_id = u.id
         LEFT JOIN users a ON t.assigned_to = a.id
         WHERE t.id = ?`,
        [id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });
  }

  /**
   * جلب تذاكر مستخدم معين
   * @param {number} userId
   * @returns {Promise<Array>}
   */
  static getUserTickets(userId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT t.*,
                (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id) as message_count
         FROM tickets t
         WHERE t.user_id = ?
         ORDER BY t.updated_at DESC`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * إضافة رسالة إلى تذكرة
   * @param {number} ticketId
   * @param {number} senderId
   * @param {string} body
   * @param {boolean} isAdmin
   * @returns {Promise<number>} معرف الرسالة
   */
  static addMessage(ticketId, senderId, body, isAdmin = false) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO ticket_messages (ticket_id, sender_id, is_admin, body)
         VALUES (?, ?, ?, ?)`,
        [ticketId, senderId, isAdmin ? 1 : 0, body],
        function(err) {
          if (err) return reject(err);
          // تحديث updated_at للتذكرة
          db.run(
            'UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [ticketId]
          );
          resolve(this.lastID);
        }
      );
    });
  }

  /**
   * جلب رسائل تذكرة
   * @param {number} ticketId
   * @returns {Promise<Array>}
   */
  static getMessages(ticketId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT tm.*, u.username as sender_username
         FROM ticket_messages tm
         JOIN users u ON tm.sender_id = u.id
         WHERE tm.ticket_id = ?
         ORDER BY tm.created_at ASC`,
        [ticketId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * تحديث حالة التذكرة
   * @param {number} id
   * @param {string} status - open|in_progress|closed
   * @returns {Promise<boolean>}
   */
  static updateStatus(id, status) {
    const s = VALID_STATUSES.includes(status) ? status : null;
    if (!s) return Promise.reject(new Error(`Invalid status: ${status}`));

    return new Promise((resolve, reject) => {
      const closedAt = status === 'closed' ? ', closed_at = CURRENT_TIMESTAMP' : '';
      db.run(
        `UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP${closedAt} WHERE id = ?`,
        [s, id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }

  /**
   * تعيين تذكرة لمشرف
   * @param {number} id
   * @param {number} adminId
   * @returns {Promise<boolean>}
   */
  static assign(id, adminId) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE tickets SET assigned_to = ?, status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [adminId, id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }

  /**
   * جلب التذاكر المتجاوزة حداً زمنياً معيناً (بالساعات)
   * @param {number} hours
   * @returns {Promise<Array>}
   */
  static getOverdue(hours = 48) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT t.*, u.username as user_username
         FROM tickets t
         JOIN users u ON t.user_id = u.id
         WHERE t.status IN ('open', 'in_progress')
           AND t.created_at <= datetime('now', ? || ' hours')
         ORDER BY t.created_at ASC`,
        [`-${hours}`],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * جلب كل التذاكر (للمشرفين)
   * @returns {Promise<Array>}
   */
  static getAll() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT t.*, u.username as user_username,
                a.username as assigned_username,
                (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id) as message_count
         FROM tickets t
         JOIN users u ON t.user_id = u.id
         LEFT JOIN users a ON t.assigned_to = a.id
         ORDER BY
           CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
           t.updated_at DESC`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }
}
