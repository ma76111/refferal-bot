import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();
const MAIN_ADMIN_ID = parseInt(process.env.MAIN_ADMIN_ID || '0');

// middleware - أدمن فقط
async function adminOnly(req, res, next) {
  const telegramId = req.user.telegram_id;
  if (telegramId === MAIN_ADMIN_ID) return next();
  db.get('SELECT id FROM admins WHERE telegram_id = ? AND is_active = 1', [telegramId], (err, row) => {
    if (row) return next();
    res.status(403).json({ error: 'Forbidden' });
  });
}

// ── إحصائيات ──────────────────────────────────────────────
router.get('/stats', authMiddleware, adminOnly, (req, res) => {
  db.get(`SELECT
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM users WHERE is_banned = 1) as banned_users,
    (SELECT COUNT(*) FROM tasks WHERE status = 'active') as active_tasks,
    (SELECT COUNT(*) FROM task_submissions WHERE status = 'pending') as pending_submissions,
    (SELECT COUNT(*) FROM deposits WHERE status = 'pending') as pending_deposits,
    (SELECT COUNT(*) FROM withdrawals WHERE status = 'pending') as pending_withdrawals,
    (SELECT COALESCE(SUM(balance),0) FROM users) as total_balance,
    (SELECT COUNT(*) FROM reports WHERE status = 'pending') as pending_reports,
    (SELECT COUNT(*) FROM appeals WHERE status = 'pending') as pending_appeals
  `, (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(row);
  });
});

// ── مستخدمون ──────────────────────────────────────────────
router.get('/users/search', authMiddleware, adminOnly, (req, res) => {
  const q = req.query.q || '';
  const param = isNaN(q) ? `%${q}%` : null;
  const sql = param
    ? `SELECT id, telegram_id, username, balance, exchange_points, is_banned, ban_status, created_at FROM users WHERE username LIKE ? LIMIT 10`
    : `SELECT id, telegram_id, username, balance, exchange_points, is_banned, ban_status, created_at FROM users WHERE telegram_id = ? LIMIT 1`;
  db.all(sql, [param || parseInt(q)], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows || []);
  });
});

router.post('/users/:id/balance', authMiddleware, adminOnly, (req, res) => {
  const { amount } = req.body;
  db.run('UPDATE users SET balance = ? WHERE id = ?', [parseFloat(amount), req.params.id], (err) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ ok: true });
  });
});

router.post('/users/:id/points', authMiddleware, adminOnly, (req, res) => {
  const { points } = req.body;
  db.run('UPDATE users SET exchange_points = ? WHERE id = ?', [parseInt(points), req.params.id], (err) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ ok: true });
  });
});

router.post('/users/:id/ban', authMiddleware, adminOnly, (req, res) => {
  const { reason, duration } = req.body; // duration = null for permanent
  const userId = req.params.id;
  db.run('UPDATE users SET is_banned = 1, ban_status = ? WHERE id = ?',
    [duration ? 'temporary' : 'permanent', userId], (err) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    const endDate = duration ? `datetime('now', '+${duration} days')` : 'NULL';
    db.run(`INSERT INTO bans (user_id, type, duration, reason, banned_by, end_date)
      VALUES (?, ?, ?, ?, ?, ${endDate})`,
      [userId, duration ? 'temporary' : 'permanent', duration, reason, req.user.id], (err2) => {
      res.json({ ok: true });
    });
  });
});

router.post('/users/:id/unban', authMiddleware, adminOnly, (req, res) => {
  const userId = req.params.id;
  db.run('UPDATE users SET is_banned = 0, ban_status = ? WHERE id = ?', ['none', userId], (err) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    db.run(`UPDATE bans SET status = 'lifted' WHERE user_id = ? AND status = 'active'`, [userId]);
    res.json({ ok: true });
  });
});

// ── إيداعات معلقة ──────────────────────────────────────────
router.get('/deposits', authMiddleware, adminOnly, (req, res) => {
  db.all(`SELECT d.*, u.telegram_id, u.username FROM deposits d
    JOIN users u ON d.user_id = u.id
    WHERE d.status = 'pending' ORDER BY d.created_at ASC`, (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows || []);
  });
});

router.post('/deposits/:id/accept', authMiddleware, adminOnly, (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM deposits WHERE id = ?', [id], (err, dep) => {
    if (!dep) return res.status(404).json({ error: 'Not found' });
    db.run('UPDATE deposits SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['accept', req.user.id, id], (err2) => {
      if (err2) return res.status(500).json({ error: 'DB error' });
      db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [dep.amount, dep.user_id]);
      res.json({ ok: true });
    });
  });
});

router.post('/deposits/:id/reject', authMiddleware, adminOnly, (req, res) => {
  const { reason } = req.body;
  db.run('UPDATE deposits SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, reject_reason = ? WHERE id = ?',
    ['reject', req.user.id, reason || 'رفض الأدمن', req.params.id], (err) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ ok: true });
  });
});

// ── سحوبات معلقة ───────────────────────────────────────────
router.get('/withdrawals', authMiddleware, adminOnly, (req, res) => {
  db.all(`SELECT w.*, u.telegram_id, u.username FROM withdrawals w
    JOIN users u ON w.user_id = u.id
    WHERE w.status = 'pending' ORDER BY w.created_at ASC`, (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows || []);
  });
});

router.post('/withdrawals/:id/complete', authMiddleware, adminOnly, (req, res) => {
  db.run('UPDATE withdrawals SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['completed', req.user.id, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ ok: true });
  });
});

router.post('/withdrawals/:id/reject', authMiddleware, adminOnly, (req, res) => {
  const { reason } = req.body;
  db.get('SELECT * FROM withdrawals WHERE id = ?', [req.params.id], (err, w) => {
    if (!w) return res.status(404).json({ error: 'Not found' });
    db.run('UPDATE withdrawals SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, reject_reason = ? WHERE id = ?',
      ['rejected', req.user.id, reason || 'رفض الأدمن', req.params.id], (err2) => {
      if (err2) return res.status(500).json({ error: 'DB error' });
      db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [w.amount, w.user_id]);
      res.json({ ok: true });
    });
  });
});

// ── إثباتات معلقة ─────────────────────────────────────────
router.get('/submissions', authMiddleware, adminOnly, (req, res) => {
  db.all(`SELECT s.*, t.bot_name, t.task_type, t.reward_per_user,
    u.telegram_id as submitter_id, u.username as submitter_username,
    owner.telegram_id as owner_telegram_id, owner.username as owner_username
    FROM task_submissions s
    JOIN tasks t ON s.task_id = t.id
    JOIN users u ON s.user_id = u.id
    JOIN users owner ON t.owner_id = owner.id
    WHERE s.status = 'pending' ORDER BY s.created_at ASC LIMIT 20`, (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows || []);
  });
});

router.post('/submissions/:id/accept', authMiddleware, adminOnly, (req, res) => {
  const id = req.params.id;
  db.get('SELECT s.*, t.reward_per_user, t.task_type FROM task_submissions s JOIN tasks t ON s.task_id = t.id WHERE s.id = ?', [id], (err, s) => {
    if (!s) return res.status(404).json({ error: 'Not found' });
    db.run('UPDATE task_submissions SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['accept', req.user.id, id], (err2) => {
      if (err2) return res.status(500).json({ error: 'DB error' });
      if (s.task_type === 'paid') {
        db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [s.reward_per_user, s.user_id]);
      }
      db.run('UPDATE tasks SET completed_count = completed_count + 1 WHERE id = ?', [s.task_id]);
      res.json({ ok: true });
    });
  });
});

router.post('/submissions/:id/reject', authMiddleware, adminOnly, (req, res) => {
  const { reason } = req.body;
  db.run('UPDATE task_submissions SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, reject_message = ? WHERE id = ?',
    ['reject', req.user.id, reason || '', req.params.id], (err) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ ok: true });
  });
});

// ── استئنافات ──────────────────────────────────────────────
router.get('/appeals', authMiddleware, adminOnly, (req, res) => {
  db.all(`SELECT a.*, u.telegram_id, u.username, b.reason as ban_reason FROM appeals a
    JOIN users u ON a.user_id = u.id
    JOIN bans b ON a.ban_id = b.id
    WHERE a.status = 'pending' ORDER BY a.created_at ASC`, (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows || []);
  });
});

router.post('/appeals/:id/approve', authMiddleware, adminOnly, (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM appeals WHERE id = ?', [id], (err, appeal) => {
    if (!appeal) return res.status(404).json({ error: 'Not found' });
    db.run('UPDATE appeals SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['approved', req.user.id, id]);
    db.run('UPDATE bans SET status = ? WHERE id = ?', ['lifted', appeal.ban_id]);
    db.run('UPDATE users SET is_banned = 0, ban_status = ? WHERE id = ?', ['none', appeal.user_id]);
    res.json({ ok: true });
  });
});

router.post('/appeals/:id/reject', authMiddleware, adminOnly, (req, res) => {
  db.run('UPDATE appeals SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?',
    ['rejected', req.user.id, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ ok: true });
  });
});

// ── إعدادات ────────────────────────────────────────────────
router.get('/settings', authMiddleware, adminOnly, (req, res) => {
  db.all('SELECT key, value FROM settings', (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    const settings = {};
    (rows || []).forEach(r => settings[r.key] = r.value);
    res.json(settings);
  });
});

router.post('/settings', authMiddleware, adminOnly, (req, res) => {
  const { key, value } = req.body;
  db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP',
    [key, value, value], (err) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ ok: true });
  });
});

// ── المحظورون ───────────────────────────────────────────────
router.get('/bans', authMiddleware, adminOnly, (req, res) => {
  db.all(`SELECT b.*, u.telegram_id, u.username FROM bans b
    JOIN users u ON b.user_id = u.id
    WHERE b.status = 'active' AND (b.end_date IS NULL OR datetime(b.end_date) > datetime('now'))
    ORDER BY b.created_at DESC LIMIT 30`, (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows || []);
  });
});

// ── سجلات الأجهزة ──────────────────────────────────────────
router.get('/device-logs', authMiddleware, adminOnly, (req, res) => {
  db.all(
    `SELECT dl.*, u.username, u.telegram_id
     FROM device_logs dl
     JOIN users u ON dl.user_id = u.id
     ORDER BY dl.created_at DESC
     LIMIT 100`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(rows || []);
    }
  );
});

// ── الحسابات المكررة (IPs مرتبطة بأكثر من 3 حسابات) ────────
router.get('/duplicate-accounts', authMiddleware, adminOnly, (req, res) => {
  db.all(
    `SELECT ip_address,
            COUNT(DISTINCT user_id) as account_count,
            GROUP_CONCAT(DISTINCT u.username) as usernames
     FROM device_logs dl
     JOIN users u ON dl.user_id = u.id
     GROUP BY ip_address
     HAVING COUNT(DISTINCT user_id) > 3
     ORDER BY account_count DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(rows || []);
    }
  );
});

// ── تعيين country_code يدوياً لمستخدم ───────────────────────
router.post('/override-ip/:userId', authMiddleware, adminOnly, (req, res) => {
  const { country_code } = req.body;
  if (!country_code) return res.status(400).json({ error: 'country_code مطلوب' });

  db.run(
    'UPDATE users SET country_code = ? WHERE id = ?',
    [country_code.toUpperCase().slice(0, 2), req.params.userId],
    function(err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
      res.json({ ok: true });
    }
  );
});

// ── إبلاغات ────────────────────────────────────────────────
router.get('/reports', authMiddleware, adminOnly, (req, res) => {
  db.all(`SELECT r.*, u1.telegram_id as reporter_tid, u1.username as reporter_name,
    u2.telegram_id as reported_tid, u2.username as reported_name, t.bot_name
    FROM reports r
    JOIN users u1 ON r.reporter_id = u1.id
    JOIN users u2 ON r.reported_user_id = u2.id
    JOIN tasks t ON r.task_id = t.id
    WHERE r.status = 'pending' ORDER BY r.created_at ASC LIMIT 20`, (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows || []);
  });
});

export default router;
