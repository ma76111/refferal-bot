import helmet from 'helmet';

/**
 * إعداد Security Headers باستخدام helmet
 */
export const securityMiddleware = helmet({
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
  frameguard: false,
  contentSecurityPolicy: false,
  referrerPolicy: { policy: 'no-referrer-when-downgrade' },
});
