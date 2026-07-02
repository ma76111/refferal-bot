import { Router } from 'express';
import db from '../db.js';
import { verifyTelegramAuth, generateToken } from '../auth.js';

const router = Router();

// POST /api/auth/telegram
// يستقبل بيانات Telegram Login Widget ويرجع JWT
router.post('/telegram', (req, res) => {
  const data = req.body;

  if (!verifyTelegramAuth(data)) {
    return res.status(401).json({ error: 'Invalid Telegram auth data' });
  }

  const telegramId = parseInt(data.id);

  db.get('SELECT * FROM users WHERE telegram_id = ?', [telegramId], (err, user) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!user) {
      return res.status(403).json({ error: 'User not registered. Please start the bot first.' });
    }
    if (user.is_banned) {
      return res.status(403).json({ error: 'Your account is banned.' });
    }

    const token = generateToken(user);
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
