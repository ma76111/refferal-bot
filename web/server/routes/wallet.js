import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

// GET /api/wallet/deposits
router.get('/deposits', authMiddleware, (req, res) => {
  db.all(
    `SELECT id, amount, method, status, created_at, reviewed_at, reject_reason
     FROM deposits WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(rows || []);
    }
  );
});

// GET /api/wallet/withdrawals
router.get('/withdrawals', authMiddleware, (req, res) => {
  db.all(
    `SELECT id, amount, method, status, created_at, reviewed_at, reject_reason
     FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(rows || []);
    }
  );
});

export default router;
