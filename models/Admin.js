import db from '../database.js';

const MAIN_ADMIN_ID = 8339087985; // الأدمن الرئيسي

class Admin {
  // التحقق من أن المستخدم أدمن رئيسي
  static isMainAdmin(telegramId) {
    // تحويل إلى رقم للتأكد من المقارنة الصحيحة
    const id = typeof telegramId === 'string' ? parseInt(telegramId) : telegramId;
    return id === MAIN_ADMIN_ID;
  }

  // التحقق من أن المستخدم أدمن (رئيسي أو ثانوي)
  static async isAdmin(telegramId) {
    if (this.isMainAdmin(telegramId)) {
      return true;
    }

    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM admins WHERE telegram_id = ? AND is_active = 1',
        [telegramId],
        (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        }
      );
    });
  }

  // الحصول على معلومات الأدمن
  static async getAdmin(telegramId) {
    if (this.isMainAdmin(telegramId)) {
      return {
        telegram_id: MAIN_ADMIN_ID,
        role: 'main',
        permissions: 'all',
        is_active: 1
      };
    }

    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM admins WHERE telegram_id = ?',
        [telegramId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  // إضافة أدمن ثانوي (فقط الأدمن الرئيسي)
  static async addAdmin(telegramId, username, addedBy) {
    if (!this.isMainAdmin(addedBy)) {
      throw new Error('Only main admin can add secondary admins');
    }

    if (this.isMainAdmin(telegramId)) {
      throw new Error('Cannot add main admin as secondary admin');
    }

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO admins (telegram_id, username, added_by, role, permissions, is_active)
         VALUES (?, ?, ?, 'secondary', 'all', 1)`,
        [telegramId, username, addedBy],
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              reject(new Error('Admin already exists'));
            } else {
              reject(err);
            }
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  // إزالة أدمن ثانوي (فقط الأدمن الرئيسي)
  static async removeAdmin(telegramId, removedBy) {
    if (!this.isMainAdmin(removedBy)) {
      throw new Error('Only main admin can remove secondary admins');
    }

    if (this.isMainAdmin(telegramId)) {
      throw new Error('Cannot remove main admin');
    }

    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM admins WHERE telegram_id = ?',
        [telegramId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }

  // تعطيل/تفعيل أدمن ثانوي
  static async toggleAdmin(telegramId, isActive, toggledBy) {
    if (!this.isMainAdmin(toggledBy)) {
      throw new Error('Only main admin can toggle secondary admins');
    }

    if (this.isMainAdmin(telegramId)) {
      throw new Error('Cannot toggle main admin');
    }

    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE admins SET is_active = ? WHERE telegram_id = ?',
        [isActive ? 1 : 0, telegramId],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes > 0);
        }
      );
    });
  }

  // الحصول على قائمة جميع الأدمنز الثانويين
  static async getAllAdmins() {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM admins ORDER BY created_at DESC',
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  // الحصول على قائمة الأدمنز النشطين فقط
  static async getActiveAdmins() {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM admins WHERE is_active = 1 ORDER BY created_at DESC',
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  // الحصول على جميع IDs الأدمنز (رئيسي + ثانويين نشطين)
  static async getAllAdminIds() {
    const secondaryAdmins = await this.getActiveAdmins();
    const adminIds = [MAIN_ADMIN_ID, ...secondaryAdmins.map(a => a.telegram_id)];
    return adminIds;
  }
}

export default Admin;
