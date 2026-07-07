import helmet from 'helmet';

/**
 * إعداد Security Headers باستخدام helmet
 */
export const securityMiddleware = helmet({
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
  frameguard: false, // disable x-frame-options to allow Telegram widget popups
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://telegram.org', 'https://*.telegram.org'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:', 'https://*.telegram.org'],
      connectSrc: ["'self'", 'https:'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'self'", 'https://oauth.telegram.org', 'https://telegram.org', 'https://*.telegram.org'],
      upgradeInsecureRequests: [],
    },
  },
  referrerPolicy: { policy: 'same-origin' },
});
