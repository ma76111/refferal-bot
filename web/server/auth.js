import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const BOT_TOKEN = process.env.BOT_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

/**
 * التحقق من بيانات Telegram Login Widget
 * https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyTelegramAuth(data) {
  const { hash, ...fields } = data;
  if (!hash) return false;

  // ترتيب الحقول أبجدياً وبناء string
  const checkString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');

  // المفتاح = SHA256 من BOT_TOKEN
  const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest();
  const expectedHash = crypto
    .createHmac('sha256', secretKey)
    .update(checkString)
    .digest('hex');

  if (expectedHash !== hash) return false;

  // التحقق من أن البيانات ليست قديمة (أكثر من ساعة)
  const authDate = parseInt(fields.auth_date);
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > 3600) return false;

  return true;
}

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, telegram_id: user.telegram_id, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const payload = verifyToken(header.slice(7));
  if (!payload) return res.status(401).json({ error: 'Invalid token' });
  req.user = payload;
  next();
}
