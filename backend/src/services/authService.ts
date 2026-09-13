import bcrypt from 'bcrypt';
import prisma from '../utils/prisma';
import { comparePassword, hashPassword } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/token';
import { UnauthorizedError } from '../utils/errors';
import { logger } from '../utils/logger';

// Dummy hash used to avoid timing-based email enumeration when a user does not exist
const DUMMY_HASH = '$2b$12$e876VzW6F8X4z5sJ4E5QeOGJ8qY0H1uF8iW5F1e876VzW6F8X4z5s';

export interface LoginResult {
  mustChangePassword?: false;
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    companyId: string;
    departmentId: string | null;
  };
}

export interface MustChangePasswordResult {
  mustChangePassword: true;
  email: string;
}

export type LoginOutput = LoginResult | MustChangePasswordResult;

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  /**
   * Authenticates user with email and password.
   * Prevents timing attacks and account enumeration per security.md Section 1.
   */
  async login(email: string, password: string): Promise<LoginOutput> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    const hashToCompare = user ? user.passwordHash : DUMMY_HASH;
    const isPasswordValid = await comparePassword(password, hashToCompare);

    if (!user || !isPasswordValid) {
      // Generic error per security.md Section 1: never leak if email exists
      throw new UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    if (user.mustChangePassword) {
      logger.info({ userId: user.id, email: user.email }, 'User must change password before accessing the platform');
      return {
        mustChangePassword: true,
        email: user.email,
      };
    }

    const payload = {
      userId: user.id,
      role: user.role as 'hr_admin' | 'manager' | 'employee',
      companyId: user.companyId,
      departmentId: user.departmentId,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Persist refresh token for server-side revocation / rotation tracking
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: sevenDaysFromNow,
        revoked: false,
      },
    });

    logger.info({ userId: user.id, role: user.role, companyId: user.companyId }, 'User logged in successfully');

    return {
      mustChangePassword: false,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        departmentId: user.departmentId,
      },
    };
  }

  /**
   * Completes initial forced password change for new accounts.
   */
  async changePassword(email: string, currentPassword: string, newPassword: string): Promise<LoginResult> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    const hashToCompare = user ? user.passwordHash : DUMMY_HASH;
    const isPasswordValid = await comparePassword(currentPassword, hashToCompare);

    if (!user || !isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const newPasswordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
      },
    });

    const payload = {
      userId: user.id,
      role: user.role as 'hr_admin' | 'manager' | 'employee',
      companyId: user.companyId,
      departmentId: user.departmentId,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: sevenDaysFromNow,
        revoked: false,
      },
    });

    logger.info({ userId: user.id, email: user.email }, 'User changed password successfully');

    return {
      mustChangePassword: false,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        departmentId: user.departmentId,
      },
    };
  }

  /**
   * Exchanges a valid, unrevoked refresh token for a new access token and rotated refresh token.
   */
  async refresh(refreshToken: string): Promise<RefreshResult> {
    // Verify cryptographic signature and expiry of the JWT
    const decoded = verifyRefreshToken(refreshToken);

    // Look up token in database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken || storedToken.revoked || storedToken.expiresAt < new Date()) {
      // Token reuse detection: if a revoked token is re-submitted, revoke all tokens for this user
      if (storedToken && storedToken.revoked) {
        logger.warn({ userId: storedToken.userId }, 'Revoked refresh token reuse detected! Invalidating all sessions.');
        await prisma.refreshToken.updateMany({
          where: { userId: storedToken.userId },
          data: { revoked: true },
        });
      }
      throw new UnauthorizedError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
    }

    // Invalidate the used refresh token (rotation)
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });

    // Fetch user to ensure user still exists and claims are up to date
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      throw new UnauthorizedError('User no longer exists', 'USER_NOT_FOUND');
    }

    const payload = {
      userId: user.id,
      role: user.role as 'hr_admin' | 'manager' | 'employee',
      companyId: user.companyId,
      departmentId: user.departmentId,
    };

    const newAccessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken(payload);

    // Store new rotated refresh token
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expiresAt: sevenDaysFromNow,
        revoked: false,
      },
    });

    logger.info({ userId: user.id }, 'Refreshed access and refresh tokens');

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Invalidates a refresh token on logout.
   */
  async logout(refreshToken: string): Promise<void> {
    try {
      await prisma.refreshToken.updateMany({
        where: { token: refreshToken },
        data: { revoked: true },
      });
      logger.info('Refresh token revoked on logout');
    } catch (err: unknown) {
      logger.warn({ err }, 'Error revoking token on logout');
    }
  }
}

export const authService = new AuthService();
export default authService;
