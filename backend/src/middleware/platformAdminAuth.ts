import { Request, Response, NextFunction } from 'express';
import { verifyPlatformAdminToken, PlatformAdminTokenPayload } from '../utils/platformAdminToken';
import { UnauthorizedError } from '../utils/errors';

declare global {
  namespace Express {
    interface Request {
      platformAdmin?: PlatformAdminTokenPayload;
    }
  }
}

/**
 * Dedicated middleware for platform-admin endpoints.
 * Completely isolated from tenant authenticate / requireRole / scoping middleware.
 * Verifies Bearer JWT access token from Authorization header against PLATFORM_ADMIN_JWT_SECRET.
 */
export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed authorization header', 'MISSING_TOKEN');
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    throw new UnauthorizedError('Token is required', 'MISSING_TOKEN');
  }

  // Verifies against PLATFORM_ADMIN_JWT_SECRET and asserts type === 'platform_admin'
  const decoded = verifyPlatformAdminToken(token);

  req.platformAdmin = decoded;
  next();
}
