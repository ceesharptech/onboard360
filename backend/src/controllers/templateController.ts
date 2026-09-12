import { Request, Response, NextFunction } from 'express';
import templateService from '../services/templateService';
import {
  createTemplateSchema,
  updateTemplateSchema,
  reorderTemplateTasksSchema,
} from '../utils/validation';
import { scopeToDepartment } from '../middleware/auth';

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0];
  return param || '';
}

export class TemplateController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createTemplateSchema.parse(req.body);

      // Enforce department scope for managers
      if (req.user!.role === 'manager') {
        if (!validated.departmentId || validated.departmentId !== req.user!.departmentId) {
          scopeToDepartment(validated.departmentId, req);
        }
      }

      const template = await templateService.createTemplate(validated, {
        userId: req.user!.userId,
        companyId: req.user!.companyId,
      });

      res.status(201).json({
        status: 'ok',
        data: template,
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user!.companyId;
      let departmentIdFilter: string | undefined;

      if (req.user!.role === 'manager') {
        // Manager only sees their own department's templates
        departmentIdFilter = req.user!.departmentId ?? undefined;
      } else if (req.query.departmentId && typeof req.query.departmentId === 'string') {
        departmentIdFilter = req.query.departmentId;
      }

      const templates = await templateService.listTemplates(companyId, departmentIdFilter);
      res.status(200).json({
        status: 'ok',
        data: templates,
      });
    } catch (error) {
      next(error);
    }
  }

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getParam(req.params.id);
      const template = await templateService.getTemplateById(id, req.user!.companyId);
      scopeToDepartment(template.departmentId, req);

      res.status(200).json({
        status: 'ok',
        data: template,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getParam(req.params.id);
      const existing = await templateService.getTemplateById(id, req.user!.companyId);
      scopeToDepartment(existing.departmentId, req);

      const validated = updateTemplateSchema.parse(req.body);

      if (validated.departmentId !== undefined && validated.departmentId !== existing.departmentId) {
        scopeToDepartment(validated.departmentId, req);
      }

      const updated = await templateService.updateTemplate(
        id,
        validated,
        req.user!.companyId
      );

      res.status(200).json({
        status: 'ok',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async reorderTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getParam(req.params.id);
      const existing = await templateService.getTemplateById(id, req.user!.companyId);
      scopeToDepartment(existing.departmentId, req);

      const validated = reorderTemplateTasksSchema.parse(req.body);
      const updated = await templateService.reorderTasks(
        id,
        validated.taskIds,
        req.user!.companyId
      );

      res.status(200).json({
        status: 'ok',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getParam(req.params.id);
      const existing = await templateService.getTemplateById(id, req.user!.companyId);
      scopeToDepartment(existing.departmentId, req);

      const result = await templateService.deleteTemplate(id, req.user!.companyId);
      res.status(200).json({
        status: 'ok',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const templateController = new TemplateController();
export default templateController;
