import { Router } from 'express';
import db from '../db.js';
import { verifyTelegramAuth, generateToken } from '../auth.js';

const router = Router();

// POST /api/auth/telegram
// يستقبل بيانات Telegram Login Widget ويرجع JWT
router.post('/telegram', async (req, res) => {
  const data = req.body;

  if (!verifyTelegramAuth(data)) {
    return res.status(401).json({ error: 'Invalid Telegram auth data' });
  }

  const telegramId = parseInt(data.id);

  db.get('SELECT * FROM users WHERE telegram_id = ?', [telegramId], async (err, user) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!user) {
      return res.status(403).json({ error: 'User not registered. Please start the bot first.' });
    }
    if (user.is_banned) {
      return res.status(403).json({ error: 'Your account is banned.' });
    }

    const token = generateToken(user);

    // تسجيل نشاط تسجيل الدخول
    try {
      const { default: ActivityLog } = await import('../../models/ActivityLog.js');
      await ActivityLog.log(user.id, 'login', {
        ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
        user_agent: req.headers['user-agent'],
      });
    } catch (_) { /* ignore */ }

    res.json({
      token,
      user: {
        id: user.id,
        telegram_id: user.telegram_id,
        username: user.username,
        balance: user.balance,
        exchange_points: user.exchange_points,
        language: user.language,
      },
    });
  });
});

export default router;
