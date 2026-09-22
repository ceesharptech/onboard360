import jwt, { JwtPayload as BaseJwtPayload, SignOptions } from 'jsonwebtoken';
import { UnauthorizedError } from './errors';

export type UserRole = 'hr_admin' | 'manager' | 'employee';

export interface UserTokenPayload {
  userId: string;
  role: UserRole;
  companyId: string;
  departmentId: string | null;
  email?: string;
}

export interface DecodedToken extends UserTokenPayload, BaseJwtPayload {
  iat: number;
  exp: number;
}

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  // If running in development / test with missing secrets, fail loud
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be defined in environment.');
  }
}

import crypto from 'crypto';

// Fixed directives from prompt: access tokens 15m, refresh tokens 7d
const ACCESS_EXPIRES_IN = (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as SignOptions['expiresIn'];
const REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as SignOptions['expiresIn'];

/**
 * Signs a JWT access token (15 minute lifetime).
 */
export function signAccessToken(payload: UserTokenPayload): string {
  const secret = process.env.JWT_ACCESS_SECRET || 'test-access-secret';
  return jwt.sign(payload, secret, {
    expiresIn: ACCESS_EXPIRES_IN,
    jwtid: crypto.randomUUID(),
  });
}

/**
 * Signs a JWT refresh token (7 day lifetime).
 */
export function signRefreshToken(payload: UserTokenPayload): string {
  const secret = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
  return jwt.sign(payload, secret, {
    expiresIn: REFRESH_EXPIRES_IN,
    jwtid: crypto.randomUUID(),
  });
}

/**
 * Verifies a JWT access token. Throws UnauthorizedError if invalid or expired.
 */
export function verifyAccessToken(token: string): DecodedToken {
  const secret = process.env.JWT_ACCESS_SECRET || 'test-access-secret';
  try {
    const decoded = jwt.verify(token, secret) as DecodedToken;
    return decoded;
  } catch (err: unknown) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Access token has expired', 'TOKEN_EXPIRED');
    }
    throw new UnauthorizedError('Invalid access token', 'INVALID_TOKEN');
  }
}

/**
 * Verifies a JWT refresh token. Throws UnauthorizedError if invalid or expired.
 */
export function verifyRefreshToken(token: string): DecodedToken {
  const secret = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
  try {
    const decoded = jwt.verify(token, secret) as DecodedToken;
    return decoded;
  } catch (err: unknown) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Refresh token has expired', 'REFRESH_TOKEN_EXPIRED');
    }
    throw new UnauthorizedError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }
}
