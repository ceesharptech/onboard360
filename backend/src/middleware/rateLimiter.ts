import rateLimit from "express-rate-limit";

/**
 * SECURITY NOTE:
 * DISABLE_RATE_LIMITING is a local-development-only escape hatch to facilitate
 * manual multi-role testing (e.g. rapid switching between HR Admin, Manager, and Employee).
 * This flag must NEVER be set to 'true' in any deployed, staging, or production environment,
 * per security.md Section 1 and Section 7 rate-limiting requirements.
 */
export const isRateLimitingDisabled = process.env.DISABLE_RATE_LIMITING === "true";

/**
 * Helper to determine if rate limiting should be bypassed.
 */
const shouldSkipRateLimit = (testHeader?: string | string[]): boolean => {
  // If explicitly disabled via environment variable, bypass completely (pass through)
  if (process.env.DISABLE_RATE_LIMITING === "true") {
    return true;
  }

  // In test mode, only apply when explicitly flagged for rate-limit testing
  if (process.env.NODE_ENV === "test" && !testHeader) {
    return true;
  }

  return false;
};

/**
 * General API rate limiter for protecting endpoints from denial-of-service and abuse.
 * 100 requests per 15 minutes per IP.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => shouldSkipRateLimit(req.headers["x-test-general-rate-limit"]),
  message: {
    error: {
      message: "Too many requests from this IP, please try again later",
      code: "TOO_MANY_REQUESTS",
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
  skip: (req) => shouldSkipRateLimit(req.headers["x-test-rate-limit"]),
  message: {
    error: {
      message: "Too many login attempts, please try again after 15 minutes",
      code: "TOO_MANY_LOGIN_ATTEMPTS",
    },
  },
});
