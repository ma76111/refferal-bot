import { Router } from 'express';
import { authMiddleware } from '../auth.js';
import db from '../db.js';

const router = Router();

/**
 * GET /api/notifications
 * جلب إشعارات المستخدم الحالي (غير منتهية الصلاحية)
 */
router.get('/', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);

  db.all(
    `SELECT * FROM notifications
     WHERE user_id = ?
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
     ORDER BY created_at DESC
     LIMIT ?`,
    [userId, limit],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ notifications: rows || [] });
    }
  );
});

/**
 * GET /api/notifications/unread-count
 * عدد الإشعارات غير المقروءة
 */
router.get('/unread-count', authMiddleware, (req, res) => {
  const userId = req.user.id;

  db.get(
    `SELECT COUNT(*) AS cnt FROM notifications
     WHERE user_id = ? AND is_read = 0
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
    [userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ count: row?.cnt ?? 0 });
    }
  );
});

/**
 * POST /api/notifications/read-all
 * تعليم جميع الإشعارات مقروءة
 */
router.post('/read-all', authMiddleware, (req, res) => {
  const userId = req.user.id;

  db.run(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
    [userId],
    (err) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true });
    }
  );
});

/**
 * POST /api/notifications/:id/read
 * تعليم إشعار محدد مقروءاً
 */
router.post('/:id/read', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const notifId = parseInt(req.params.id);

  if (!notifId) return res.status(400).json({ error: 'Invalid notification ID' });

  db.run(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
    [notifId, userId],
    function (err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (this.changes === 0) return res.status(404).json({ error: 'Notification not found' });
      res.json({ success: true });
    }
  );
});

/**
 * GET /api/notifications/prefs
 * جلب تفضيلات الإشعارات
 */
router.get('/prefs', authMiddleware, (req, res) => {
  const userId = req.user.id;

  db.get(
    'SELECT * FROM notification_prefs WHERE user_id = ?',
    [userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });

      // الإعدادات الافتراضية إذا لم تُنشأ بعد
      const prefs = row ? {
        submission_accepted: row.submission_accepted,
        submission_rejected: row.submission_rejected,
        task_completed:      row.task_completed,
        promotional:         row.promotional,
        system_update:       row.system_update,
      } : {
        submission_accepted: 1,
        submission_rejected: 1,
        task_completed:      1,
        promotional:         1,
        system_update:       1,
      };

      res.json({ prefs });
    }
  );
});

/**
 * PUT /api/notifications/prefs
 * تحديث تفضيلات الإشعارات
 */
router.put('/prefs', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const {
    submission_accepted = 1,
    submission_rejected = 1,
    task_completed = 1,
    promotional = 1,
    system_update = 1,
  } = req.body;

  db.run(
    `INSERT INTO notification_prefs
       (user_id, submission_accepted, submission_rejected, task_completed, promotional, system_update, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       submission_accepted = excluded.submission_accepted,
       submission_rejected = excluded.submission_rejected,
       task_completed      = excluded.task_completed,
       promotional         = excluded.promotional,
       system_update       = excluded.system_update,
       updated_at          = CURRENT_TIMESTAMP`,
    [userId,
     submission_accepted ? 1 : 0,
     submission_rejected ? 1 : 0,
     task_completed ? 1 : 0,
     promotional ? 1 : 0,
     system_update ? 1 : 0],
    (err) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ success: true });
    }
  );
});

export default router;
