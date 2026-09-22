import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { loginSchema, refreshSchema, logoutSchema, changePasswordSchema } from '../utils/validation';
import prisma from '../utils/prisma';
import { UnauthorizedError } from '../utils/errors';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = loginSchema.parse(req.body);
      const result = await authService.login(validatedInput.email, validatedInput.password);

      if (result.mustChangePassword) {
        res.status(200).json({
          status: 'must_change_password',
          data: result,
          message: 'Password change required before accessing the platform',
        });
        return;
      }

      res.status(200).json({
        status: 'ok',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = changePasswordSchema.parse(req.body);
      const result = await authService.changePassword(
        validatedInput.email,
        validatedInput.currentPassword,
        validatedInput.newPassword
      );

      res.status(200).json({
        status: 'ok',
        data: result,
        message: 'Password changed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = refreshSchema.parse(req.body);
      const result = await authService.refresh(validatedInput.refreshToken);
      res.status(200).json({
        status: 'ok',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = logoutSchema.parse(req.body);
      await authService.logout(validatedInput.refreshToken);
      res.status(200).json({
        status: 'ok',
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: {
          id: true,
          email: true,
          role: true,
          companyId: true,
          departmentId: true,
          company: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      res.status(200).json({
        status: 'ok',
        data: {
          id: user.id,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
          companyName: user.company?.name || null,
          departmentId: user.departmentId,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
export default authController;

