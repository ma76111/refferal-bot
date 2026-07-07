import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();

// إنشاء مهمة جديدة
router.post('/tasks/create', authMiddleware, async (req, res) => {
  const { task_type, bot_name, referral_link, required_count, reward_per_user, proof_type, verification_instructions } = req.body;
  const userId = req.user.id;

  if (!task_type || !bot_name || !referral_link || !required_count)
    return res.status(400).json({ error: 'جميع الحقول مطلوبة' });

  const count = parseInt(required_count);
  if (count <= 0) return res.status(400).json({ error: 'عدد الأشخاص غير صحيح' });

  if (task_type === 'paid') {
    const reward = parseFloat(reward_per_user);
    if (!reward || reward <= 0) return res.status(400).json({ error: 'المكافأة غير صحيحة' });
    const total = reward * count;

    db.get('SELECT balance FROM users WHERE id = ?', [userId], (err, user) => {
      if (!user || parseFloat(user.balance) < total)
        return res.status(400).json({ error: `رصيد غير كافٍ. المطلوب: ${total.toFixed(2)} USDT` });

      db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [total, userId], (err2) => {
        if (err2) return res.status(500).json({ error: 'DB error' });
        db.run(
          `INSERT INTO tasks (owner_id, bot_name, referral_link, required_count, task_type, reward_per_user, proof_type, verification_instructions, status)
           VALUES (?, ?, ?, ?, 'paid', ?, ?, ?, 'active')`,
          [userId, bot_name, referral_link, count, reward, proof_type || 'text', verification_instructions || ''],
          function(err3) {
            if (err3) return res.status(500).json({ error: 'DB error' });
            const taskId = this.lastID;
            // تسجيل النشاط
            import('../../models/ActivityLog.js').then(({ default: ActivityLog }) => {
              ActivityLog.log(userId, 'task_created', { task_id: taskId, task_type: 'paid', bot_name }).catch(() => {});
            }).catch(() => {});
            res.json({ ok: true, id: taskId });
          }
        );
      });
    });
  } else {
    // تبادل - خصم نقاط
    db.get('SELECT value FROM settings WHERE key = ?', ['exchange_points_cost'], (err, row) => {
      const costPerPerson = parseInt(row?.value) || 3;
      const totalPoints = costPerPerson * count;

      db.get('SELECT exchange_points FROM users WHERE id = ?', [userId], (err2, user) => {
        if (!user || (user.exchange_points || 0) < totalPoints)
          return res.status(400).json({ error: `نقاط غير كافية. المطلوب: ${totalPoints} نقطة` });

        db.run('UPDATE users SET exchange_points = exchange_points - ? WHERE id = ?', [totalPoints, userId], (err3) => {
          if (err3) return res.status(500).json({ error: 'DB error' });
          db.run(
            `INSERT INTO tasks (owner_id, bot_name, referral_link, required_count, task_type, reward_per_user, proof_type, verification_instructions, status)
             VALUES (?, ?, ?, ?, 'exchange', 0, ?, ?, 'active')`,
            [userId, bot_name, referral_link, count, proof_type || 'text', verification_instructions || ''],
            function(err4) {
              if (err4) return res.status(500).json({ error: 'DB error' });
              const taskId = this.lastID;
              import('../../models/ActivityLog.js').then(({ default: ActivityLog }) => {
                ActivityLog.log(userId, 'task_created', { task_id: taskId, task_type: 'exchange', bot_name }).catch(() => {});
              }).catch(() => {});
              res.json({ ok: true, id: taskId });
            }
          );
        });
      });
    });
  }
});

// الحصول على إعدادات عامة للمستخدم
router.get('/user/settings', authMiddleware, (req, res) => {
  db.all('SELECT key, value FROM settings', (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    const settings = {};
    (rows || []).forEach(r => settings[r.key] = r.value);
    res.json(settings);
  });
});
router.post('/tasks/:id/hide', authMiddleware, (req, res) => {
  db.run(
    `INSERT OR IGNORE INTO hidden_tasks (user_id, task_id) VALUES (?, ?)`,
    [req.user.id, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({ ok: true });
    }
  );
});

// تقديم إثبات
router.post('/tasks/:id/submit', authMiddleware, (req, res) => {
  const { proof_text } = req.body;
  const taskId = req.params.id;
  const userId = req.user.id;

  // تحقق إن المهمة موجودة ونشطة
  db.get(`SELECT * FROM tasks WHERE id = ? AND status = 'active'`, [taskId], (err, task) => {
    if (err || !task) return res.status(404).json({ error: 'المهمة غير موجودة أو منتهية' });
    if (task.owner_id === userId) return res.status(400).json({ error: 'لا يمكنك تنفيذ مهمتك' });
    if (task.completed_count >= task.required_count) return res.status(400).json({ error: 'المهمة اكتملت' });

    // تحقق إن المستخدم لم يقدم من قبل
    db.get(`SELECT id FROM task_submissions WHERE task_id = ? AND user_id = ?`, [taskId, userId], (err2, existing) => {
      if (existing) return res.status(400).json({ error: 'قدمت إثباتاً لهذه المهمة من قبل' });

      db.run(
        `INSERT INTO task_submissions (task_id, user_id, proof_text, status) VALUES (?, ?, ?, 'pending')`,
        [taskId, userId, proof_text || ''],
        function(err3) {
          if (err3) return res.status(500).json({ error: 'DB error' });
          res.json({ ok: true, id: this.lastID });
        }
      );
    });
  });
});

// طلب إيداع
router.post('/wallet/deposit', authMiddleware, (req, res) => {
  const { amount, method, binance_id } = req.body;
  if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ error: 'مبلغ غير صحيح' });

  db.run(
    `INSERT INTO deposits (user_id, amount, method, binance_id, status) VALUES (?, ?, ?, ?, 'pending')`,
    [req.user.id, parseFloat(amount), method || 'binance', binance_id || ''],
    function(err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      const depId = this.lastID;
      import('../../models/ActivityLog.js').then(({ default: ActivityLog }) => {
        ActivityLog.log(req.user.id, 'deposit', { deposit_id: depId, amount: parseFloat(amount), method: method || 'binance' }).catch(() => {});
      }).catch(() => {});
      res.json({ ok: true, id: depId });
    }
  );
});

// طلب سحب
router.post('/wallet/withdraw', authMiddleware, (req, res) => {
  const { amount, method, binance_id, wallet_address, network } = req.body;
  const userId = req.user.id;

  if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ error: 'مبلغ غير صحيح' });

  // تحقق من الرصيد
  db.get('SELECT balance FROM users WHERE id = ?', [userId], (err, user) => {
    if (err || !user) return res.status(500).json({ error: 'DB error' });
    if (parseFloat(user.balance) < parseFloat(amount)) return res.status(400).json({ error: 'رصيد غير كافٍ' });

    // خصم الرصيد مؤقتاً
    db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [parseFloat(amount), userId], (err2) => {
      if (err2) return res.status(500).json({ error: 'DB error' });

      db.run(
        `INSERT INTO withdrawals (user_id, amount, method, binance_id, wallet_address, network, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [userId, parseFloat(amount), method || 'binance', binance_id || '', wallet_address || '', network || 'BSC'],
        function(err3) {
          if (err3) {
            // إرجاع الرصيد لو فشل الإدراج
            db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [parseFloat(amount), userId]);
            return res.status(500).json({ error: 'DB error' });
          }
          const wdId = this.lastID;
          import('../../models/ActivityLog.js').then(({ default: ActivityLog }) => {
            ActivityLog.log(userId, 'withdrawal', { withdrawal_id: wdId, amount: parseFloat(amount), method: method || 'binance' }).catch(() => {});
          }).catch(() => {});
          res.json({ ok: true, id: wdId });
        }
      );
    });
  });
});

export default router;
