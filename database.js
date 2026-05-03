import sqlite3 from 'sqlite3';
import config from './config.js';

const db = new sqlite3.Database(config.DATABASE_PATH);

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
    FOREIGN KEY (submission_id) REFERENCES task_submissions(id)
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
});

export default db;
