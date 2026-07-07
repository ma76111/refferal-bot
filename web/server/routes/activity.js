import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

// GET /api/user/activity - سجل الأنشطة مع pagination
router.get('/activity', authMiddleware, (req, res) => {
  const userId   = req.user.id;
  const page     = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(100, parseInt(req.query.pageSize) || 20);
  const eventType = req.query.eventType || null;
  const offset   = (page - 1) * pageSize;

  let countSql = 'SELECT COUNT(*) as total FROM activity_log WHERE user_id = ?';
  let dataSql  = `SELECT * FROM activity_log WHERE user_id = ?`;
  const countParams = [userId];
  const dataParams  = [userId];

  if (eventType) {
    countSql += ' AND event_type = ?';
    dataSql  += ' AND event_type = ?';
    countParams.push(eventType);
    dataParams.push(eventType);
  }

  dataSql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  dataParams.push(pageSize, offset);

  db.get(countSql, countParams, (err, countRow) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    const total = countRow?.total ?? 0;

    db.all(dataSql, dataParams, (err2, rows) => {
      if (err2) return res.status(500).json({ error: 'DB error' });
      res.json({
        data: rows || [],
        total,
        page,
        pageSize,
        pages: Math.ceil(total / pageSize),
      });
    });
  });
});

// GET /api/user/balance-chart - بيانات الرصيد آخر 30 يوم
router.get('/balance-chart', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const days   = Math.min(90, parseInt(req.query.days) || 30);

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
      if (err) return res.status(500).json({ error: 'DB error' });

      const byDay = {};
      for (const row of rows || []) {
        if (!byDay[row.day]) byDay[row.day] = { day: row.day, deposit: 0, withdrawal: 0 };
        try {
          const meta = JSON.parse(row.metadata || '{}');
          const amount = parseFloat(meta.amount || 0);
          if (row.event_type === 'deposit')    byDay[row.day].deposit    += amount;
          if (row.event_type === 'withdrawal') byDay[row.day].withdrawal += amount;
        } catch (_) { /* ignore */ }
      }

      res.json(Object.values(byDay));
    }
  );
});

// GET /api/user/widgets-config - تفضيلات الودجات
router.get('/widgets-config', authMiddleware, (req, res) => {
  db.get(
    `SELECT value FROM settings WHERE key = ?`,
    [`widgets_config_${req.user.id}`],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (!row) return res.json({});
      try {
        res.json(JSON.parse(row.value));
      } catch (_) {
        res.json({});
      }
    }
  );
});

// PUT /api/user/widgets-config - حفظ تفضيلات الودجات
router.put('/widgets-config', authMiddleware, (req, res) => {
  const key   = `widgets_config_${req.user.id}`;
  const value = JSON.stringify(req.body || {});

  db.run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP`,
    [key, value, value],
    (err) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({ ok: true });
    }
  );
});

export default router;
