import helmet from 'helmet';

/**
 * إعداد Security Headers باستخدام helmet
 */
export const securityMiddleware = helmet({
  hsts: false, // disable HSTS - causes issues with tunnel/dev environments
  frameguard: false, // allow Telegram widget popups
  contentSecurityPolicy: false, // disable CSP - handled separately if needed
  referrerPolicy: { policy: 'no-referrer-when-downgrade' },
});
