import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { loginSchema, refreshSchema, logoutSchema } from '../utils/validation';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = loginSchema.parse(req.body);
      const result = await authService.login(validatedInput.email, validatedInput.password);
      res.status(200).json({
        status: 'ok',
        data: result,
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
}

export const authController = new AuthController();
export default authController;
