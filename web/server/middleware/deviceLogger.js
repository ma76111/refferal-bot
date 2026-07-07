import crypto from 'crypto';
import db from '../db.js';

/**
 * استخراج IP الحقيقي من الطلب
 * @param {object} req
 * @returns {string}
 */
function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    ''
  );
}

/**
 * توليد بصمة الجهاز من IP + User-Agent
 * @param {string} ip
 * @param {string} userAgent
 * @returns {string}
 */
function buildFingerprint(ip, userAgent) {
  return crypto
    .createHash('sha256')
    .update(`${ip}|${userAgent}`)
    .digest('hex');
}

/**
 * تسجيل جهاز/جلسة المستخدم في قاعدة البيانات
 * @param {number} userId
 * @param {object} req - كائن Request من Express
 * @param {string} sessionType - 'web' أو 'bot'
 * @returns {Promise<void>}
 */
export function logDevice(userId, req, sessionType = 'web') {
  return new Promise((resolve) => {
    const ip = getClientIP(req);
    const userAgent = req.headers?.['user-agent'] || '';
    const fingerprint = buildFingerprint(ip, userAgent);

    // تسجيل في device_logs
    db.run(
      `INSERT INTO device_logs (user_id, ip_address, user_agent, fingerprint, session_type)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, ip, userAgent, fingerprint, sessionType],
      (err) => {
        if (err) console.error('[deviceLogger] log error:', err.message);
      }
    );

    // تحديث last_known_ip في users
    db.run(
      'UPDATE users SET last_known_ip = ? WHERE id = ?',
      [ip, userId],
      () => resolve()
    );
  });
}

/**
 * التحقق مما إذا كانت بصمة الجهاز مرتبطة بحساب محظور
 * @param {string} fingerprint
 * @returns {Promise<boolean>}
 */
export function isBannedDevice(fingerprint) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT dl.user_id FROM device_logs dl
       JOIN users u ON dl.user_id = u.id
       WHERE dl.fingerprint = ?
         AND (u.is_banned = 1 OR u.ban_status != 'none')
       LIMIT 1`,
      [fingerprint],
      (err, row) => {
        if (err) return reject(err);
        resolve(!!row);
      }
    );
  });
}

/**
 * Middleware للتسجيل التلقائي (اختياري)
 * يُستخدم عند /api/auth فقط
 */
export async function deviceLoggerMiddleware(req, res, next) {
  if (req.user?.id) {
    logDevice(req.user.id, req, 'web').catch(() => {});
  }
  next();
}
