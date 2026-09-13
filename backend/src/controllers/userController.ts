import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/userService';
import { createUserSchema } from '../utils/validation';
import { UnauthorizedError } from '../utils/errors';

export class UserController {
  async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required', 'UNAUTHORIZED');
      }

      const validatedInput = createUserSchema.parse(req.body);
      const newUser = await userService.createUser(req.user, validatedInput);

      res.status(201).json({
        status: 'ok',
        data: {
          user: newUser,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required', 'UNAUTHORIZED');
      }

      const departmentId = typeof req.query.departmentId === 'string' ? req.query.departmentId : undefined;
      const users = await userService.listUsers(req.user.companyId, departmentId);

      res.status(200).json({
        status: 'ok',
        data: users,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
export default userController;
