import { Request, Response, NextFunction } from 'express';
import { platformAdminService } from '../services/platformAdminService';
import {
  platformAdminLoginSchema,
  createCompanySchema,
  companyListQuerySchema,
} from '../utils/validation';

export class PlatformAdminController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = platformAdminLoginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid input data',
            details: parsed.error.issues,
          },
        });
        return;
      }

      const result = await platformAdminService.login(
        parsed.data.email,
        parsed.data.password
      );

      res.status(200).json({
        status: 'ok',
        data: result,
        token: result.accessToken,
        accessToken: result.accessToken,
        admin: result.admin,
      });
    } catch (err) {
      next(err);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json({
        status: 'ok',
        data: req.platformAdmin,
      });
    } catch (err) {
      next(err);
    }
  }

  async createCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createCompanySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid company or HR admin input',
            details: parsed.error.issues,
          },
        });
        return;
      }

      const result = await platformAdminService.createCompany(parsed.data);

      res.status(201).json({
        status: 'ok',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async listCompanies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = companyListQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid query parameters',
            details: parsed.error.issues,
          },
        });
        return;
      }

      const result = await platformAdminService.listCompanies(parsed.data);

      res.status(200).json({
        status: 'ok',
        data: result.data,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  async getCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const company = await platformAdminService.getCompany(id);

      res.status(200).json({
        status: 'ok',
        data: company,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const platformAdminController = new PlatformAdminController();
export default platformAdminController;
