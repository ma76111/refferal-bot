/**
 * سكريبت migration لإنشاء الجداول والأعمدة الجديدة في bot.db
 * شغّله مرة واحدة: node migrate.js
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'bot.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) { console.error('❌ Failed to connect:', err.message); process.exit(1); }
  console.log('✅ Connected to', DB_PATH);
});

function run(sql, label) {
  return new Promise((resolve) => {
    db.run(sql, (err) => {
      if (err && !err.message.includes('duplicate column') && !err.message.includes('already exists')) {
        console.error(`❌ ${label}:`, err.message);
      } else {
        console.log(`✅ ${label}`);
      }
      resolve();
    });
  });
}

async function migrate() {
  console.log('\n🚀 بدء Migration...\n');

  // ── فهارس جديدة ────────────────────────────────────────────
  await run(`CREATE INDEX IF NOT EXISTS idx_tasks_status_created ON tasks(status, created_at)`, 'Index: tasks(status, created_at)');
  await run(`CREATE INDEX IF NOT EXISTS idx_submissions_status ON task_submissions(status)`, 'Index: submissions(status)');
  await run(`CREATE INDEX IF NOT EXISTS idx_submissions_created ON task_submissions(created_at)`, 'Index: submissions(created_at)');
  await run(`CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status)`, 'Index: deposits(status)');
  await run(`CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status)`, 'Index: withdrawals(status)');

  // ── جدول notification_prefs ────────────────────────────────
  await run(`CREATE TABLE IF NOT EXISTS notification_prefs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    submission_accepted INTEGER DEFAULT 1,
    submission_rejected INTEGER DEFAULT 1,
    task_completed INTEGER DEFAULT 1,
    promotional INTEGER DEFAULT 1,
    system_update INTEGER DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`, 'Table: notification_prefs');

  // ── جدول notifications ─────────────────────────────────────
  await run(`CREATE TABLE IF NOT EXISTS notifications (
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
  )`, 'Table: notifications');

  await run(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read)`, 'Index: notifications(user_id, is_read)');

  // ── جدول tickets ───────────────────────────────────────────
  await run(`CREATE TABLE IF NOT EXISTS tickets (
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
  )`, 'Table: tickets');

  await run(`CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status, priority)`, 'Index: tickets(status, priority)');

  // ── جدول ticket_messages ───────────────────────────────────
  await run(`CREATE TABLE IF NOT EXISTS ticket_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    is_admin INTEGER DEFAULT 0,
    body TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id),
    FOREIGN KEY (sender_id) REFERENCES users(id)
  )`, 'Table: ticket_messages');

  // ── جدول device_logs ───────────────────────────────────────
  await run(`CREATE TABLE IF NOT EXISTS device_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    fingerprint TEXT,
    country_code TEXT,
    session_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`, 'Table: device_logs');

  await run(`CREATE INDEX IF NOT EXISTS idx_device_logs_ip ON device_logs(ip_address)`, 'Index: device_logs(ip_address)');
  await run(`CREATE INDEX IF NOT EXISTS idx_device_logs_fp ON device_logs(fingerprint)`, 'Index: device_logs(fingerprint)');

  // ── جدول activity_log ──────────────────────────────────────
  await run(`CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`, 'Table: activity_log');

  await run(`CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id, created_at)`, 'Index: activity_log(user_id, created_at)');

  // ── جدول task_audit ────────────────────────────────────────
  await run(`CREATE TABLE IF NOT EXISTS task_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    changed_by INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (changed_by) REFERENCES users(id)
  )`, 'Table: task_audit');

  // ── أعمدة جديدة للمهام ─────────────────────────────────────
  await run(`ALTER TABLE tasks ADD COLUMN paused_at DATETIME DEFAULT NULL`, 'Column: tasks.paused_at');
  await run(`ALTER TABLE tasks ADD COLUMN country_code TEXT DEFAULT NULL`, 'Column: tasks.country_code');

  // ── أعمدة جديدة للمستخدمين ─────────────────────────────────
  await run(`ALTER TABLE users ADD COLUMN notification_channel TEXT DEFAULT 'both'`, 'Column: users.notification_channel');
  await run(`ALTER TABLE users ADD COLUMN last_known_ip TEXT DEFAULT NULL`, 'Column: users.last_known_ip');
  await run(`ALTER TABLE users ADD COLUMN country_code TEXT DEFAULT NULL`, 'Column: users.country_code');

  // ── أعمدة جديدة للإيداعات ──────────────────────────────────
  await run(`ALTER TABLE deposits ADD COLUMN wallet_address TEXT DEFAULT NULL`, 'Column: deposits.wallet_address');
  await run(`ALTER TABLE deposits ADD COLUMN network TEXT DEFAULT NULL`, 'Column: deposits.network');

  // ── أعمدة جديدة للسحوبات ───────────────────────────────────
  await run(`ALTER TABLE withdrawals ADD COLUMN ton_address TEXT DEFAULT NULL`, 'Column: withdrawals.ton_address');

  console.log('\n✅ Migration اكتملت بنجاح!\n');
  db.close();
}

migrate().catch(err => {
  console.error('❌ Migration فشلت:', err);
  process.exit(1);
});
