import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../auth.js';

const router = Router();
const MAIN_ADMIN_ID = parseInt(process.env.MAIN_ADMIN_ID || '0');

// middleware - أدمن فقط
function adminOnly(req, res, next) {
  const telegramId = req.user.telegram_id;
  if (telegramId === MAIN_ADMIN_ID) return next();
  db.get(
    'SELECT id FROM admins WHERE telegram_id = ? AND is_active = 1',
    [telegramId],
    (err, row) => {
      if (row) return next();
      res.status(403).json({ error: 'Forbidden' });
    }
  );
}

// توليد رقم تذكرة فريد
function generateTicketNo() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let suffix = '';
  for (let i = 0; i < 8; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `TKT-${suffix}`;
}

// POST /api/tickets - إنشاء تذكرة جديدة
router.post('/', authMiddleware, (req, res) => {
  const { subject, priority = 'medium' } = req.body;
  if (!subject || !subject.trim()) {
    return res.status(400).json({ error: 'الموضوع مطلوب' });
  }

  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  const prio = validPriorities.includes(priority) ? priority : 'medium';
  const ticketNo = generateTicketNo();

  db.run(
    `INSERT INTO tickets (ticket_no, user_id, subject, priority)
     VALUES (?, ?, ?, ?)`,
    [ticketNo, req.user.id, subject.trim(), prio],
    function(err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({ ok: true, id: this.lastID, ticket_no: ticketNo });
    }
  );
});

// GET /api/tickets - تذاكر المستخدم الحالي فقط (عزل بـ user_id)
router.get('/', authMiddleware, (req, res) => {
  db.all(
    `SELECT t.*,
            (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id) as message_count
     FROM tickets t
     WHERE t.user_id = ?
     ORDER BY t.updated_at DESC`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(rows || []);
    }
  );
});

// GET /api/tickets/:id - تفاصيل تذكرة + رسائلها
router.get('/:id', authMiddleware, (req, res) => {
  const ticketId = req.params.id;
  const userId   = req.user.id;

  db.get(
    `SELECT t.*, u.username as user_username,
            a.username as assigned_username
     FROM tickets t
     JOIN users u ON t.user_id = u.id
     LEFT JOIN users a ON t.assigned_to = a.id
     WHERE t.id = ?`,
    [ticketId],
    (err, ticket) => {
      if (err)     return res.status(500).json({ error: 'DB error' });
      if (!ticket) return res.status(404).json({ error: 'Not found' });

      // المستخدم يمكنه رؤية تذكرته فقط ما لم يكن أدمن
      const isAdminUser = req.user.telegram_id === MAIN_ADMIN_ID;
      if (!isAdminUser && ticket.user_id !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      db.all(
        `SELECT tm.*, u2.username as sender_username
         FROM ticket_messages tm
         JOIN users u2 ON tm.sender_id = u2.id
         WHERE tm.ticket_id = ?
         ORDER BY tm.created_at ASC`,
        [ticketId],
        (err2, messages) => {
          if (err2) return res.status(500).json({ error: 'DB error' });
          res.json({ ...ticket, messages: messages || [] });
        }
      );
    }
  );
});

// POST /api/tickets/:id/reply - رد المستخدم
router.post('/:id/reply', authMiddleware, (req, res) => {
  const { body } = req.body;
  if (!body || !body.trim()) {
    return res.status(400).json({ error: 'الرسالة مطلوبة' });
  }

  const ticketId = req.params.id;

  db.get('SELECT * FROM tickets WHERE id = ?', [ticketId], (err, ticket) => {
    if (err)     return res.status(500).json({ error: 'DB error' });
    if (!ticket) return res.status(404).json({ error: 'Not found' });
    if (ticket.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (ticket.status === 'closed') return res.status(400).json({ error: 'التذكرة مغلقة' });

    db.run(
      `INSERT INTO ticket_messages (ticket_id, sender_id, is_admin, body)
       VALUES (?, ?, 0, ?)`,
      [ticketId, req.user.id, body.trim()],
      function(err2) {
        if (err2) return res.status(500).json({ error: 'DB error' });
        db.run('UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [ticketId]);
        res.json({ ok: true, id: this.lastID });
      }
    );
  });
});

// GET /api/admin/tickets - كل التذاكر (admin)
router.get('/admin/all', authMiddleware, adminOnly, (req, res) => {
  db.all(
    `SELECT t.*, u.username as user_username,
            a.username as assigned_username,
            (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id) as message_count
     FROM tickets t
     JOIN users u ON t.user_id = u.id
     LEFT JOIN users a ON t.assigned_to = a.id
     ORDER BY
       CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
       t.updated_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(rows || []);
    }
  );
});

// POST /api/admin/tickets/:id/reply - رد المشرف
router.post('/admin/:id/reply', authMiddleware, adminOnly, (req, res) => {
  const { body } = req.body;
  if (!body || !body.trim()) {
    return res.status(400).json({ error: 'الرسالة مطلوبة' });
  }

  const ticketId = req.params.id;

  db.get('SELECT * FROM tickets WHERE id = ?', [ticketId], (err, ticket) => {
    if (err)     return res.status(500).json({ error: 'DB error' });
    if (!ticket) return res.status(404).json({ error: 'Not found' });

    db.run(
      `INSERT INTO ticket_messages (ticket_id, sender_id, is_admin, body)
       VALUES (?, ?, 1, ?)`,
      [ticketId, req.user.id, body.trim()],
      function(err2) {
        if (err2) return res.status(500).json({ error: 'DB error' });
        db.run(`UPDATE tickets SET updated_at = CURRENT_TIMESTAMP,
                  status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END
                WHERE id = ?`, [ticketId]);
        res.json({ ok: true, id: this.lastID });
      }
    );
  });
});

// PUT /api/admin/tickets/:id/status - تغيير الحالة
router.put('/admin/:id/status', authMiddleware, adminOnly, (req, res) => {
  const { status } = req.body;
  const validStatuses = ['open', 'in_progress', 'closed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'حالة غير صالحة' });
  }

  const closedAt = status === 'closed' ? ', closed_at = CURRENT_TIMESTAMP' : '';
  db.run(
    `UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP${closedAt} WHERE id = ?`,
    [status, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ ok: true });
    }
  );
});

// PUT /api/admin/tickets/:id/assign - تعيين لمشرف
router.put('/admin/:id/assign', authMiddleware, adminOnly, (req, res) => {
  const { admin_id } = req.body;
  db.run(
    `UPDATE tickets SET assigned_to = ?, status = 'in_progress', updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [admin_id || req.user.id, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ ok: true });
    }
  );
});

export default router;
