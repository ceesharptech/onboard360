import jwt, { JwtPayload as BaseJwtPayload, SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { UnauthorizedError } from './errors';

export interface PlatformAdminTokenPayload {
  type: 'platform_admin';
  adminId: string;
  email: string;
}

export interface DecodedPlatformAdminToken extends PlatformAdminTokenPayload, BaseJwtPayload {
  iat: number;
  exp: number;
}

const PLATFORM_ADMIN_SECRET =
  process.env.PLATFORM_ADMIN_JWT_SECRET || 'fallback-platform-admin-secret-dev';

const EXPIRES_IN = (process.env.PLATFORM_ADMIN_JWT_EXPIRES_IN || '15m') as SignOptions['expiresIn'];

/**
 * Signs a dedicated platform-admin JWT token.
 * Structurally distinguishable by `type: 'platform_admin'` and signed with its own secret.
 */
export function signPlatformAdminToken(payload: { adminId: string; email: string }): string {
  const tokenPayload: PlatformAdminTokenPayload = {
    type: 'platform_admin',
    adminId: payload.adminId,
    email: payload.email,
  };

  return jwt.sign(tokenPayload, PLATFORM_ADMIN_SECRET, {
    expiresIn: EXPIRES_IN,
    jwtid: crypto.randomUUID(),
  });
}

/**
 * Verifies a platform-admin JWT.
 * Throws UnauthorizedError if token is invalid, expired, or not of type 'platform_admin'.
 */
export function verifyPlatformAdminToken(token: string): PlatformAdminTokenPayload {
  try {
    const decoded = jwt.verify(token, PLATFORM_ADMIN_SECRET) as DecodedPlatformAdminToken;

    if (!decoded || decoded.type !== 'platform_admin') {
      throw new UnauthorizedError('Invalid platform admin token claims', 'INVALID_TOKEN_TYPE');
    }

    return {
      type: 'platform_admin',
      adminId: decoded.adminId,
      email: decoded.email,
    };
  } catch (err: any) {
    if (err instanceof UnauthorizedError) {
      throw err;
    }
    if (err.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Platform admin token has expired', 'TOKEN_EXPIRED');
    }
    throw new UnauthorizedError('Invalid platform admin token', 'INVALID_TOKEN');
  }
}
