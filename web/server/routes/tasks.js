import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

// GET /api/tasks
router.get('/', authMiddleware, (req, res) => {
  const userId = req.user.id;

  // جلب country_code للمستخدم لفلترة المهام
  db.get('SELECT country_code FROM users WHERE id = ?', [userId], (err, userRow) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    const userCountry = userRow?.country_code || null;

    db.all(
      `SELECT t.id, t.bot_name, t.referral_link, t.required_count, t.completed_count,
              t.task_type, t.reward_per_user, t.verification_instructions, t.proof_type,
              t.created_at, u.username as owner_username,
              CASE WHEN t.owner_id = ? THEN 1 ELSE 0 END as is_owner,
              COALESCE(ROUND(AVG(r.rating), 1), 0) as owner_rating,
              COUNT(DISTINCT r.id) as owner_rating_count
       FROM tasks t
       JOIN users u ON t.owner_id = u.id
       LEFT JOIN ratings r ON r.rated_user_id = t.owner_id
       LEFT JOIN task_submissions ts ON ts.task_id = t.id AND ts.user_id = ?
       LEFT JOIN hidden_tasks ht ON ht.task_id = t.id AND ht.user_id = ?
       WHERE t.status = 'active'
         AND t.completed_count < t.required_count
         AND u.ban_status = 'none'
         AND (t.owner_id = ? OR (ts.id IS NULL AND ht.id IS NULL))
         AND (t.country_code IS NULL OR t.country_code = '' OR ? IS NULL OR t.country_code = ?)
       GROUP BY t.id
       ORDER BY CASE WHEN t.task_type = 'paid' THEN t.reward_per_user ELSE 0 END DESC, t.created_at DESC`,
      [userId, userId, userId, userId, userCountry, userCountry],
      (err2, rows) => {
        if (err2) return res.status(500).json({ error: 'DB error' });
        res.json(rows || []);
      }
    );
  });
});

// GET /api/tasks/mine
router.get('/mine', authMiddleware, (req, res) => {
  db.all(
    `SELECT t.*,
            (SELECT COUNT(*) FROM task_submissions WHERE task_id = t.id AND status = 'accept') as accepted_count,
            (SELECT COUNT(*) FROM task_submissions WHERE task_id = t.id AND status = 'pending') as pending_count
     FROM tasks t WHERE t.owner_id = ? ORDER BY t.created_at DESC`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(rows || []);
    }
  );
});

// GET /api/tasks/submissions
router.get('/submissions', authMiddleware, (req, res) => {
  db.all(
    `SELECT s.id, s.task_id, s.status, s.created_at, s.reviewed_at,
            s.reject_type, s.reject_message, s.can_retry,
            t.bot_name, t.task_type, t.reward_per_user,
            owner.username as owner_username
     FROM task_submissions s
     JOIN tasks t ON s.task_id = t.id
     JOIN users owner ON t.owner_id = owner.id
     WHERE s.user_id = ? ORDER BY s.created_at DESC`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(rows || []);
    }
  );
});

// PATCH /api/tasks/:id - تعديل الحقول المسموحة فقط
const ALLOWED_FIELDS  = ['bot_name', 'verification_instructions', 'proof_type'];
const PROTECTED_FIELDS = ['referral_link', 'reward_per_user', 'required_count'];

router.patch('/:id', authMiddleware, async (req, res) => {
  const taskId = req.params.id;
  const userId = req.user.id;

  // رفض تعديل الحقول المحمية
  const forbidden = PROTECTED_FIELDS.filter(f => f in req.body);
  if (forbidden.length > 0) {
    return res.status(400).json({
      error: `لا يمكن تعديل الحقول: ${forbidden.join(', ')}`,
    });
  }

  // التحقق من ملكية المهمة
  db.get('SELECT * FROM tasks WHERE id = ? AND owner_id = ?', [taskId, userId], async (err, task) => {
    if (err)   return res.status(500).json({ error: 'DB error' });
    if (!task) return res.status(404).json({ error: 'المهمة غير موجودة' });

    const updates = [];
    const params  = [];

    for (const field of ALLOWED_FIELDS) {
      if (field in req.body) {
        updates.push(`${field} = ?`);
        params.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'لا توجد حقول للتعديل' });
    }

    params.push(taskId);

    db.run(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
      params,
      async function(err2) {
        if (err2) return res.status(500).json({ error: 'DB error' });

        // تسجيل التعديلات في task_audit
        const { default: TaskAudit } = await import('../../models/TaskAudit.js');
        for (const field of ALLOWED_FIELDS) {
          if (field in req.body && String(req.body[field]) !== String(task[field])) {
            await TaskAudit.log(taskId, userId, field, task[field], req.body[field]).catch(() => {});
          }
        }

        // تسجيل نشاط
        try {
          const { default: ActivityLog } = await import('../../models/ActivityLog.js');
          await ActivityLog.log(userId, 'task_updated', { task_id: taskId, fields: updates });
        } catch (_) { /* ignore */ }

        res.json({ ok: true });
      }
    );
  });
});

// POST /api/tasks/:id/pause - إيقاف مؤقت
router.post('/:id/pause', authMiddleware, (req, res) => {
  const taskId = req.params.id;
  const userId = req.user.id;

  db.get('SELECT * FROM tasks WHERE id = ? AND owner_id = ?', [taskId, userId], (err, task) => {
    if (err)   return res.status(500).json({ error: 'DB error' });
    if (!task) return res.status(404).json({ error: 'المهمة غير موجودة' });
    if (task.status !== 'active') return res.status(400).json({ error: 'المهمة ليست نشطة' });

    db.run(
      `UPDATE tasks SET status = 'paused', paused_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [taskId],
      function(err2) {
        if (err2) return res.status(500).json({ error: 'DB error' });

        // تسجيل في audit
        import('../../models/TaskAudit.js').then(({ default: TaskAudit }) => {
          TaskAudit.log(taskId, userId, 'status', 'active', 'paused').catch(() => {});
        }).catch(() => {});

        res.json({ ok: true });
      }
    );
  });
});

// POST /api/tasks/:id/resume - استئناف
router.post('/:id/resume', authMiddleware, (req, res) => {
  const taskId = req.params.id;
  const userId = req.user.id;

  db.get('SELECT * FROM tasks WHERE id = ? AND owner_id = ?', [taskId, userId], (err, task) => {
    if (err)   return res.status(500).json({ error: 'DB error' });
    if (!task) return res.status(404).json({ error: 'المهمة غير موجودة' });
    if (task.status !== 'paused') return res.status(400).json({ error: 'المهمة ليست متوقفة' });

    db.run(
      `UPDATE tasks SET status = 'active', paused_at = NULL WHERE id = ?`,
      [taskId],
      function(err2) {
        if (err2) return res.status(500).json({ error: 'DB error' });

        import('../../models/TaskAudit.js').then(({ default: TaskAudit }) => {
          TaskAudit.log(taskId, userId, 'status', 'paused', 'active').catch(() => {});
        }).catch(() => {});

        res.json({ ok: true });
      }
    );
  });
});

// GET /api/tasks/:id/audit - سجل تدقيق المهمة
router.get('/:id/audit', authMiddleware, (req, res) => {
  const taskId = req.params.id;
  const userId = req.user.id;

  // التحقق من ملكية المهمة أو أنه مشرف
  db.get('SELECT owner_id FROM tasks WHERE id = ?', [taskId], (err, task) => {
    if (err)   return res.status(500).json({ error: 'DB error' });
    if (!task) return res.status(404).json({ error: 'المهمة غير موجودة' });

    const MAIN_ADMIN_ID = parseInt(process.env.MAIN_ADMIN_ID || '0');
    if (task.owner_id !== userId && req.user.telegram_id !== MAIN_ADMIN_ID) {
      // تحقق إضافي من جدول admins
      db.get(
        'SELECT id FROM admins WHERE telegram_id = ? AND is_active = 1',
        [req.user.telegram_id],
        (err2, adminRow) => {
          if (!adminRow) return res.status(403).json({ error: 'Forbidden' });
          fetchAudit();
        }
      );
    } else {
      fetchAudit();
    }

    function fetchAudit() {
      db.all(
        `SELECT ta.*, u.username as changed_by_username
         FROM task_audit ta
         JOIN users u ON ta.changed_by = u.id
         WHERE ta.task_id = ?
         ORDER BY ta.created_at DESC`,
        [taskId],
        (err3, rows) => {
          if (err3) return res.status(500).json({ error: 'DB error' });
          res.json(rows || []);
        }
      );
    }
  });
});

export default router;
