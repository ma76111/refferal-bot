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
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://telegram.org', 'https://*.telegram.org'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https:', 'http:'],
      fontSrc: ["'self'", 'https:', 'data:'],
      objectSrc: ["'none'"],
      frameSrc: ["'self'", 'https://oauth.telegram.org', 'https://telegram.org', 'https://*.telegram.org'],
    },
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});
