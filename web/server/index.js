import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import authRouter from './routes/auth.js';
import userRouter from './routes/user.js';
import tasksRouter from './routes/tasks.js';
import walletRouter from './routes/wallet.js';
import adminRouter from './routes/admin.js';
import actionsRouter from './routes/actions.js';
import notificationsRouter from './routes/notifications.js';
import ticketsRouter from './routes/tickets.js';
import activityRouter from './routes/activity.js';
import { securityMiddleware } from './middleware/security.js';
import { publicLimiter, protectedLimiter } from './middleware/rateLimit.js';
import db from './db.js';
import { sendNotification } from '../../handlers/notificationHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.WEB_PORT || 3001;

// Security headers
app.use(securityMiddleware);
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json());

// Rate limiting على المسارات العامة
app.use('/api/auth', publicLimiter);
// Rate limiting على المسارات المحمية
app.use('/api/user', protectedLimiter);
app.use('/api/tasks', protectedLimiter);
app.use('/api/wallet', protectedLimiter);
app.use('/api/admin', protectedLimiter);
app.use('/api/notifications', protectedLimiter);
app.use('/api/tickets', protectedLimiter);

app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/user', activityRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/admin', adminRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api', actionsRouter);

// ── Job دوري كل 15 دقيقة: فحص التذاكر المتجاوزة 48 ساعة ──
async function checkOverdueTickets() {
  try {
    const overdue = await new Promise((resolve, reject) => {
      db.all(
        `SELECT t.*, u.username as user_username
         FROM tickets t
         JOIN users u ON t.user_id = u.id
         WHERE t.status IN ('open', 'in_progress')
           AND t.created_at <= datetime('now', '-48 hours')
         ORDER BY t.created_at ASC`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    if (overdue.length === 0) return;

    // جلب المشرفين وإرسال إشعار لكل واحد
    const mainAdminId = parseInt(process.env.MAIN_ADMIN_ID || '0');
    const admins = await new Promise((resolve) => {
      db.all(
        `SELECT DISTINCT u.id FROM users u
         WHERE u.telegram_id = ?
            OR u.id IN (SELECT user_id FROM admins WHERE is_active = 1)`,
        [mainAdminId],
        (_err, rows) => resolve(rows || [])
      );
    });

    for (const admin of admins) {
      await sendNotification(admin.id, 'system_update', {
        title: `⚠️ ${overdue.length} تذكرة متأخرة تجاوزت 48 ساعة`,
        body: overdue.slice(0, 3).map(t => `#${t.ticket_no}: ${t.subject}`).join('\n'),
        link: '/admin',
      }).catch(() => {});
    }
  } catch (err) {
    console.error('checkOverdueTickets error:', err.message);
  }
}

setInterval(checkOverdueTickets, 15 * 60 * 1000);

const clientBuild = path.resolve(__dirname, '../client/dist');
app.use(express.static(clientBuild));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientBuild, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});
