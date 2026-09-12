import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter for protecting endpoints from denial-of-service and abuse.
 * 100 requests per 15 minutes per IP.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // In test mode, only apply when explicitly flagged for rate-limit testing
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-general-rate-limit']) {
      return true;
    }
    return false;
  },
  message: {
    error: {
      message: 'Too many requests from this IP, please try again later',
      code: 'TOO_MANY_REQUESTS',
    },
  },
});

/**
 * Strict rate limiter for the /auth/login endpoint.
 * Protects against brute-force and credential-stuffing attacks.
 * 5 attempts per 15 minutes per IP.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // In test mode, only apply when explicitly flagged for rate-limit testing
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      return true;
    }
    return false;
  },
  message: {
    error: {
      message: 'Too many login attempts, please try again after 15 minutes',
      code: 'TOO_MANY_LOGIN_ATTEMPTS',
    },
  },
});
