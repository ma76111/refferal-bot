import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../auth.js';
import {
  validateTRC20Address,
  validateTONAddress,
  validateBinancePayId,
  validateAmount,
} from '../utils/validators.js';

const router = Router();

// GET /api/wallet/deposits
router.get('/deposits', authMiddleware, (req, res) => {
  db.all(
    `SELECT id, amount, method, status, created_at, reviewed_at, reject_reason,
            binance_id, wallet_address, network
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
    `SELECT id, amount, method, status, created_at, reviewed_at, reject_reason,
            binance_id, wallet_address, network, ton_address
     FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(rows || []);
    }
  );
});

/**
 * التحقق من صحة بيانات الإيداع حسب طريقة الدفع
 * @param {object} body
 * @returns {{ ok: boolean, error?: string }}
 */
function validateDepositInput(body) {
  const { method, amount, binance_id, wallet_address } = body;

  if (!validateAmount(amount)) {
    return { ok: false, error: 'مبلغ غير صحيح' };
  }

  if (method === 'binance') {
    if (!validateBinancePayId(binance_id)) {
      return { ok: false, error: 'Binance Pay ID غير صالح (يجب أن يكون رقماً من 9-12 خانة)' };
    }
  } else if (method === 'trc20') {
    if (!validateTRC20Address(wallet_address)) {
      return { ok: false, error: 'عنوان TRC20 غير صالح (يجب أن يبدأ بـ T ويحتوي 34 حرفاً)' };
    }
  } else if (method === 'ton') {
    if (!validateTONAddress(wallet_address)) {
      return { ok: false, error: 'عنوان TON غير صالح' };
    }
  } else {
    return { ok: false, error: 'طريقة دفع غير مدعومة (binance | trc20 | ton)' };
  }

  return { ok: true };
}

/**
 * التحقق من صحة بيانات السحب حسب طريقة الدفع
 */
function validateWithdrawInput(body) {
  const { method, amount, binance_id, wallet_address, ton_address } = body;

  if (!validateAmount(amount)) {
    return { ok: false, error: 'مبلغ غير صحيح' };
  }

  if (method === 'binance') {
    if (!validateBinancePayId(binance_id)) {
      return { ok: false, error: 'Binance Pay ID غير صالح (يجب أن يكون رقماً من 9-12 خانة)' };
    }
  } else if (method === 'trc20') {
    if (!validateTRC20Address(wallet_address)) {
      return { ok: false, error: 'عنوان TRC20 غير صالح (يجب أن يبدأ بـ T ويحتوي 34 حرفاً)' };
    }
  } else if (method === 'ton') {
    const addr = ton_address || wallet_address;
    if (!validateTONAddress(addr)) {
      return { ok: false, error: 'عنوان TON غير صالح' };
    }
  } else {
    return { ok: false, error: 'طريقة دفع غير مدعومة (binance | trc20 | ton)' };
  }

  return { ok: true };
}

// POST /api/wallet/deposit - إيداع مع دعم الطرق الثلاث
router.post('/deposit', authMiddleware, (req, res) => {
  const { method = 'binance', amount, binance_id, wallet_address } = req.body;

  const validation = validateDepositInput(req.body);
  if (!validation.ok) return res.status(400).json({ error: validation.error });

  const networkMap = { trc20: 'TRC20', ton: 'TON', binance: 'BSC' };

  db.run(
    `INSERT INTO deposits (user_id, amount, method, binance_id, wallet_address, network, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    [
      req.user.id,
      parseFloat(amount),
      method,
      method === 'binance' ? (binance_id || '') : '',
      method !== 'binance' ? (wallet_address || '') : '',
      networkMap[method] || 'BSC',
    ],
    function(err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      const depId = this.lastID;
      import('../../models/ActivityLog.js').then(({ default: ActivityLog }) => {
        ActivityLog.log(req.user.id, 'deposit', { deposit_id: depId, amount: parseFloat(amount), method }).catch(() => {});
      }).catch(() => {});
      res.json({ ok: true, id: depId });
    }
  );
});

// POST /api/wallet/withdraw - سحب مع دعم الطرق الثلاث
router.post('/withdraw', authMiddleware, (req, res) => {
  const { method = 'binance', amount, binance_id, wallet_address, ton_address } = req.body;
  const userId = req.user.id;

  const validation = validateWithdrawInput(req.body);
  if (!validation.ok) return res.status(400).json({ error: validation.error });

  db.get('SELECT balance FROM users WHERE id = ?', [userId], (err, user) => {
    if (err || !user) return res.status(500).json({ error: 'DB error' });
    if (parseFloat(user.balance) < parseFloat(amount)) {
      return res.status(400).json({ error: 'رصيد غير كافٍ' });
    }

    db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [parseFloat(amount), userId], (err2) => {
      if (err2) return res.status(500).json({ error: 'DB error' });

      const networkMap = { trc20: 'TRC20', ton: 'TON', binance: 'BSC' };
      const tonAddr = method === 'ton' ? (ton_address || wallet_address || '') : '';
      const walletAddr = method === 'trc20' ? (wallet_address || '') : '';
      const binId = method === 'binance' ? (binance_id || '') : '';

      db.run(
        `INSERT INTO withdrawals (user_id, amount, method, binance_id, wallet_address, network, ton_address, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [userId, parseFloat(amount), method, binId, walletAddr, networkMap[method] || 'BSC', tonAddr],
        function(err3) {
          if (err3) {
            db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [parseFloat(amount), userId]);
            return res.status(500).json({ error: 'DB error' });
          }
          const wdId = this.lastID;
          import('../../models/ActivityLog.js').then(({ default: ActivityLog }) => {
            ActivityLog.log(userId, 'withdrawal', { withdrawal_id: wdId, amount: parseFloat(amount), method }).catch(() => {});
          }).catch(() => {});
          res.json({ ok: true, id: wdId });
        }
      );
    });
  });
});

export default router;
