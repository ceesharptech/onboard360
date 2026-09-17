import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/userService';
import { createUserSchema, paginationQuerySchema } from '../utils/validation';
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

      const query = paginationQuerySchema.parse(req.query);
      const result = await userService.listUsers(req.user.companyId, {
        departmentId: query.departmentId,
        search: query.search,
        page: query.page,
        limit: query.limit,
      });

      res.status(200).json({
        status: 'ok',
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
export default userController;
