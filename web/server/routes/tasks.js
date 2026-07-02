import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

// GET /api/tasks — المهام المتاحة
router.get('/', authMiddleware, (req, res) => {
  const userId = req.user.id;

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
     WHERE t.status = 'active'
       AND t.completed_count < t.required_count
       AND u.ban_status = 'none'
       AND (
         t.owner_id = ? OR (
           t.id NOT IN (SELECT task_id FROM task_submissions WHERE user_id = ?)
           AND t.id NOT IN (SELECT task_id FROM hidden_tasks WHERE user_id = ?)
         )
       )
     GROUP BY t.id
     ORDER BY CASE WHEN t.task_type = 'paid' THEN t.reward_per_user ELSE 0 END DESC, t.created_at DESC`,
    [userId, userId, userId, userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(rows || []);
    }
  );
});

// GET /api/tasks/mine — مهامي
router.get('/mine', authMiddleware, (req, res) => {
  const userId = req.user.id;

  db.all(
    `SELECT t.*,
            (SELECT COUNT(*) FROM task_submissions WHERE task_id = t.id AND status = 'accept') as accepted_count,
            (SELECT COUNT(*) FROM task_submissions WHERE task_id = t.id AND status = 'pending') as pending_count
     FROM tasks t
     WHERE t.owner_id = ?
     ORDER BY t.created_at DESC`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(rows || []);
    }
  );
});

// GET /api/tasks/submissions — إثباتاتي
router.get('/submissions', authMiddleware, (req, res) => {
  const userId = req.user.id;

  db.all(
    `SELECT s.id, s.task_id, s.status, s.created_at, s.reviewed_at,
            s.reject_type, s.reject_message, s.can_retry,
            t.bot_name, t.task_type, t.reward_per_user,
            owner.username as owner_username
     FROM task_submissions s
     JOIN tasks t ON s.task_id = t.id
     JOIN users owner ON t.owner_id = owner.id
     WHERE s.user_id = ?
     ORDER BY s.created_at DESC`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(rows || []);
    }
  );
});

export default router;
