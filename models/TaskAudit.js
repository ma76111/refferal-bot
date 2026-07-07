import db from '../database.js';

export default class TaskAudit {
  /**
   * تسجيل تعديل على مهمة
   * @param {number} taskId
   * @param {number} changedBy - معرف المستخدم الذي أجرى التعديل
   * @param {string} fieldName - اسم الحقل المعدَّل
   * @param {*} oldValue
   * @param {*} newValue
   * @returns {Promise<number>}
   */
  static log(taskId, changedBy, fieldName, oldValue, newValue) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO task_audit (task_id, changed_by, field_name, old_value, new_value)
         VALUES (?, ?, ?, ?, ?)`,
        [taskId, changedBy, fieldName,
         oldValue !== null && oldValue !== undefined ? String(oldValue) : null,
         newValue !== null && newValue !== undefined ? String(newValue) : null],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  /**
   * جلب سجل تدقيق مهمة
   * @param {number} taskId
   * @returns {Promise<Array>}
   */
  static getByTask(taskId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT ta.*, u.username as changed_by_username
         FROM task_audit ta
         JOIN users u ON ta.changed_by = u.id
         WHERE ta.task_id = ?
         ORDER BY ta.created_at DESC`,
        [taskId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }
}
