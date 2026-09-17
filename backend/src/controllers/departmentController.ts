import { Request, Response, NextFunction } from 'express';
import departmentService from '../services/departmentService';
import {
  addMentorSchema,
  createDepartmentSchema,
  updateDepartmentSchema,
  paginationQuerySchema,
} from '../utils/validation';
import { scopeToDepartment } from '../middleware/auth';

export class DepartmentController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user!.companyId;
      const query = paginationQuerySchema.parse(req.query);
      const result = await departmentService.listDepartments(companyId, query);
      res.status(200).json({
        status: 'ok',
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const departmentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const department = await departmentService.getDepartmentById(departmentId, req.user!.companyId);
      res.status(200).json({
        status: 'ok',
        data: department,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createDepartmentSchema.parse(req.body);
      const department = await departmentService.createDepartment(req.user!.companyId, validated.name);
      res.status(201).json({
        status: 'ok',
        data: department,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const departmentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const validated = updateDepartmentSchema.parse(req.body);
      const department = await departmentService.updateDepartment(
        departmentId,
        req.user!.companyId,
        validated.name
      );
      res.status(200).json({
        status: 'ok',
        data: department,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const departmentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await departmentService.deleteDepartment(departmentId, req.user!.companyId);
      res.status(200).json({
        status: 'ok',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMentors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const departmentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      scopeToDepartment(departmentId, req);

      const mentors = await departmentService.getDepartmentMentors(departmentId, req.user!.companyId);
      res.status(200).json({
        status: 'ok',
        data: mentors,
      });
    } catch (error) {
      next(error);
    }
  }

  async addMentor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const departmentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      scopeToDepartment(departmentId, req);

      const validated = addMentorSchema.parse(req.body);
      const mentor = await departmentService.addMentorToPool(
        departmentId,
        validated.userId,
        req.user!.companyId
      );

      res.status(201).json({
        status: 'ok',
        data: mentor,
      });
    } catch (error) {
      next(error);
    }
  }

  async removeMentor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const departmentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const mentorId = Array.isArray(req.params.mentorId) ? req.params.mentorId[0] : req.params.mentorId;
      scopeToDepartment(departmentId, req);

      const result = await departmentService.removeMentorFromPool(
        departmentId,
        mentorId,
        req.user!.companyId
      );

      res.status(200).json({
        status: 'ok',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const departmentController = new DepartmentController();
export default departmentController;
