import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';
import { backupToGithub } from './backup_to_github.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new sqlite3.Database(config.DATABASE_PATH);

// WAL mode: يحمي من فقدان البيانات عند الانقطاع المفاجئ
db.run('PRAGMA journal_mode=WAL');
db.run('PRAGMA synchronous=NORMAL');
db.run('PRAGMA cache_size=10000');
db.run('PRAGMA temp_store=MEMORY');

// Indexes لتسريع الـ queries
db.run('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)');
db.run('CREATE INDEX IF NOT EXISTS idx_tasks_status_created ON tasks(status, created_at)');
db.run('CREATE INDEX IF NOT EXISTS idx_submissions_user ON task_submissions(user_id)');
db.run('CREATE INDEX IF NOT EXISTS idx_submissions_task ON task_submissions(task_id)');
db.run('CREATE INDEX IF NOT EXISTS idx_submissions_status ON task_submissions(status)');
db.run('CREATE INDEX IF NOT EXISTS idx_submissions_created ON task_submissions(created_at)');
db.run('CREATE INDEX IF NOT EXISTS idx_hidden_user ON hidden_tasks(user_id)');
db.run('CREATE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram_id)');
db.run('CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status)');
db.run('CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status)');
db.run('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read)');
db.run('CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status, priority)');
db.run('CREATE INDEX IF NOT EXISTS idx_device_logs_ip ON device_logs(ip_address)');
db.run('CREATE INDEX IF NOT EXISTS idx_device_logs_fingerprint ON device_logs(fingerprint)');
db.run('CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id, created_at)');

// Backup تلقائي كل 30 دقيقة
const BACKUP_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

function runBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `bot_${timestamp}.db`);
  fs.copyFile(config.DATABASE_PATH, dest, (err) => {
    if (err) return;
    // احتفظ بآخر 48 نسخة فقط (يوم كامل)
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.db'))
      .sort();
    if (files.length > 48) {
      files.slice(0, files.length - 48).forEach(f =>
        fs.unlinkSync(path.join(BACKUP_DIR, f))
      );
    }
  });
}

setInterval(runBackup, 30 * 60 * 1000); // كل 30 دقيقة

// Backup إلى GitHub كل 24 ساعة
setInterval(backupToGithub, 24 * 60 * 60 * 1000);
// رفع فوري عند بدء التشغيل بعد دقيقة
setTimeout(backupToGithub, 60 * 1000);

db.serialize(() => {
  // جدول المستخدمين
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    telegram_id INTEGER UNIQUE NOT NULL,
    username TEXT,
    language TEXT DEFAULT 'ar',
    balance REAL DEFAULT 0,
    exchange_points INTEGER DEFAULT 0,
    is_banned INTEGER DEFAULT 0,
    violation_points INTEGER DEFAULT 0,
    last_violation_date DATETIME DEFAULT NULL,
    ban_status TEXT DEFAULT 'none',
    ban_expires_at DATETIME DEFAULT NULL,
    restrictions TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // جدول المهام
  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    bot_name TEXT NOT NULL,
    referral_link TEXT NOT NULL,
    required_count INTEGER NOT NULL,
    completed_count INTEGER DEFAULT 0,
    task_type TEXT NOT NULL,
    reward_per_user REAL DEFAULT 0,
    verification_instructions TEXT,
    proof_type TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
  )`);

  // جدول تنفيذ المهام
  db.run(`CREATE TABLE IF NOT EXISTS task_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    proof_text TEXT,
    proof_images TEXT,
    status TEXT DEFAULT 'pending',
    reviewed_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    reject_type TEXT DEFAULT NULL,
    reject_message TEXT DEFAULT NULL,
    can_retry INTEGER DEFAULT 0,
    improvement_deadline DATETIME DEFAULT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(task_id, user_id)
  )`);

  // جدول رصيد الإحالات
  db.run(`CREATE TABLE IF NOT EXISTS referral_credits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    task_id INTEGER NOT NULL,
    earned_credits INTEGER DEFAULT 0,
    used_credits INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
  )`);

  // جدول الإعدادات
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // جدول المهام المخفية
  db.run(`CREATE TABLE IF NOT EXISTS hidden_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    task_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    UNIQUE(user_id, task_id)
  )`);

  // جدول الإيداعات
  db.run(`CREATE TABLE IF NOT EXISTS deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    method TEXT NOT NULL,
    binance_id TEXT,
    txid TEXT,
    screenshot_id TEXT,
    transfer_time TEXT,
    status TEXT DEFAULT 'pending',
    reviewed_by INTEGER,
    reviewed_at DATETIME,
    reject_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // جدول السحوبات
  db.run(`CREATE TABLE IF NOT EXISTS withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    method TEXT NOT NULL,
    binance_id TEXT,
    wallet_address TEXT,
    network TEXT,
    screenshot_id TEXT,
    status TEXT DEFAULT 'pending',
    reviewed_by INTEGER,
    reviewed_at DATETIME,
    reject_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // جدول الإبلاغات
  db.run(`CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id INTEGER NOT NULL,
    reported_user_id INTEGER NOT NULL,
    task_id INTEGER NOT NULL,
    submission_id INTEGER NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    reviewed_by INTEGER,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reporter_id) REFERENCES users(id),
    FOREIGN KEY (reported_user_id) REFERENCES users(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (submission_id) REFERENCES task_submissions(id),
    UNIQUE(reporter_id, reported_user_id, submission_id)
  )`);

  // إضافة حقول جديدة لجدول التقديمات (تجاهل الخطأ إذا كانت موجودة)
  db.run(`ALTER TABLE task_submissions ADD COLUMN reject_type TEXT DEFAULT NULL`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding reject_type:', err.message);
    }
  });
  
  db.run(`ALTER TABLE task_submissions ADD COLUMN reject_message TEXT DEFAULT NULL`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding reject_message:', err.message);
    }
  });
  
  db.run(`ALTER TABLE task_submissions ADD COLUMN can_retry INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding can_retry:', err.message);
    }
  });

  db.run(`ALTER TABLE task_submissions ADD COLUMN improvement_deadline DATETIME DEFAULT NULL`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding improvement_deadline:', err.message);
    }
  });

  // إضافة حقول نظام المخالفات لجدول المستخدمين
  db.run(`ALTER TABLE users ADD COLUMN violation_points INTEGER DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding violation_points:', err.message);
    }
  });

  db.run(`ALTER TABLE users ADD COLUMN last_violation_date DATETIME DEFAULT NULL`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding last_violation_date:', err.message);
    }
  });

  db.run(`ALTER TABLE users ADD COLUMN ban_status TEXT DEFAULT 'none'`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding ban_status:', err.message);
    }
  });

  db.run(`ALTER TABLE users ADD COLUMN ban_expires_at DATETIME DEFAULT NULL`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding ban_expires_at:', err.message);
    }
  });

  db.run(`ALTER TABLE users ADD COLUMN restrictions TEXT DEFAULT NULL`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding restrictions:', err.message);
    }
  });

  // جدول المخالفات
  db.run(`CREATE TABLE IF NOT EXISTS violations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    points INTEGER NOT NULL,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    status TEXT DEFAULT 'active',
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // جدول التقييدات
  db.run(`CREATE TABLE IF NOT EXISTS restrictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    duration INTEGER,
    start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_date DATETIME,
    reason TEXT,
    status TEXT DEFAULT 'active',
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // جدول الحظر
  db.run(`CREATE TABLE IF NOT EXISTS bans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    duration INTEGER,
    reason TEXT,
    banned_by INTEGER,
    start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_date DATETIME,
    status TEXT DEFAULT 'active',
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (banned_by) REFERENCES users(id)
  )`);

  // جدول الاستئنافات
  db.run(`CREATE TABLE IF NOT EXISTS appeals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ban_id INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    reviewed_by INTEGER,
    review_note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (ban_id) REFERENCES bans(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
  )`);

  // جدول التقييمات
  db.run(`CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    rater_user_id INTEGER NOT NULL,
    rated_user_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (rater_user_id) REFERENCES users(id),
    FOREIGN KEY (rated_user_id) REFERENCES users(id),
    UNIQUE(task_id, rater_user_id)
  )`);

  // جدول الرسائل الجماعية
  db.run(`CREATE TABLE IF NOT EXISTS broadcasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    target_type TEXT DEFAULT 'all',
    target_ids TEXT,
    status TEXT DEFAULT 'pending',
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (admin_id) REFERENCES users(id)
  )`);

  // جدول الأدمنز الثانويين
  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER UNIQUE NOT NULL,
    username TEXT,
    added_by INTEGER NOT NULL,
    role TEXT DEFAULT 'secondary',
    permissions TEXT DEFAULT 'all',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (added_by) REFERENCES users(id)
  )`);

  // جدول تفضيلات الإشعارات
  db.run(`CREATE TABLE IF NOT EXISTS notification_prefs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    submission_accepted INTEGER DEFAULT 1,
    submission_rejected INTEGER DEFAULT 1,
    task_completed INTEGER DEFAULT 1,
    promotional INTEGER DEFAULT 1,
    system_update INTEGER DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // جدول الإشعارات
  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    link TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // جدول تذاكر الدعم
  db.run(`CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_no TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'open',
    assigned_to INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id)
  )`);

  // جدول رسائل التذاكر
  db.run(`CREATE TABLE IF NOT EXISTS ticket_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    is_admin INTEGER DEFAULT 0,
    body TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id),
    FOREIGN KEY (sender_id) REFERENCES users(id)
  )`);

  // جدول سجلات الأجهزة
  db.run(`CREATE TABLE IF NOT EXISTS device_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    fingerprint TEXT,
    country_code TEXT,
    session_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // جدول سجل الأنشطة
  db.run(`CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // جدول تدقيق المهام
  db.run(`CREATE TABLE IF NOT EXISTS task_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    changed_by INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (changed_by) REFERENCES users(id)
  )`);

  // إضافة حقول جديدة لجدول المهام
  db.run(`ALTER TABLE tasks ADD COLUMN paused_at DATETIME DEFAULT NULL`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding paused_at:', err.message);
    }
  });

  db.run(`ALTER TABLE tasks ADD COLUMN country_code TEXT DEFAULT NULL`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding country_code to tasks:', err.message);
    }
  });

  // إضافة حقول جديدة لجدول المستخدمين
  db.run(`ALTER TABLE users ADD COLUMN notification_channel TEXT DEFAULT 'both'`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding notification_channel:', err.message);
    }
  });

  db.run(`ALTER TABLE users ADD COLUMN last_known_ip TEXT DEFAULT NULL`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding last_known_ip:', err.message);
    }
  });

  db.run(`ALTER TABLE users ADD COLUMN country_code TEXT DEFAULT NULL`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding country_code to users:', err.message);
    }
  });

  // إضافة حقول جديدة لجدول الإيداعات
  db.run(`ALTER TABLE deposits ADD COLUMN wallet_address TEXT DEFAULT NULL`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding wallet_address to deposits:', err.message);
    }
  });

  db.run(`ALTER TABLE deposits ADD COLUMN network TEXT DEFAULT NULL`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding network to deposits:', err.message);
    }
  });

  // إضافة حقول جديدة لجدول السحوبات
  db.run(`ALTER TABLE withdrawals ADD COLUMN ton_address TEXT DEFAULT NULL`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding ton_address:', err.message);
    }
  });

});

export default db;
