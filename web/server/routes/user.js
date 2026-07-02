import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

// GET /api/user/me
router.get('/me', authMiddleware, (req, res) => {
  db.get('SELECT * FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const exchangePoints = user.exchange_points || 0;
    res.json({
      id: user.id,
      telegram_id: user.telegram_id,
      username: user.username,
      balance: user.balance || 0,
      exchange_points: exchangePoints,
      language: user.language,
      created_at: user.created_at,
    });
  });
});

// GET /api/user/stats
router.get('/stats', authMiddleware, (req, res) => {
  const userId = req.user.id;

  db.get(
    `SELECT
       (SELECT COUNT(*) FROM tasks WHERE owner_id = ? AND status = 'active') as active_tasks,
       (SELECT COUNT(*) FROM task_submissions WHERE user_id = ? AND status = 'accept') as completed_submissions,
       (SELECT COUNT(*) FROM task_submissions WHERE user_id = ? AND status = 'pending') as pending_submissions,
       (SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE user_id = ? AND status = 'accept') as total_deposited,
       (SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE user_id = ? AND status = 'completed') as total_withdrawn`,
    [userId, userId, userId, userId, userId],
    (err, stats) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(stats);
    }
  );
});

export default router;
