import { rateLimit } from 'express-rate-limit';

/**
 * Rate limiter للمسارات العامة: 100 طلب/دقيقة لكل IP
 */
export const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

/**
 * Rate limiter للمسارات المحمية: 30 طلب/دقيقة لكل مستخدم
 */
export const protectedLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id?.toString() || req.ip,
  message: { error: 'Too many requests, please try again later.' },
});
