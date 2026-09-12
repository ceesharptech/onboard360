import { Request, Response, NextFunction } from 'express';
import employeeService from '../services/employeeService';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  updateEmployeeTaskSchema,
  paginationQuerySchema,
} from '../utils/validation';
import { scopeToOwnEmployee } from '../middleware/auth';
import { ForbiddenError } from '../utils/errors';

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0];
  return param || '';
}

export class EmployeeController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createEmployeeSchema.parse(req.body);
      const employee = await employeeService.createEmployee(validated, req.user!.companyId);

      res.status(201).json({
        status: 'ok',
        data: employee,
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user!.companyId;
      const pagination = paginationQuerySchema.parse(req.query);

      let departmentIdFilter: string | undefined;

      if (req.user!.role === 'employee') {
        // Employee can only list their own employee record
        const employee = await employeeService.listEmployees(companyId, {
          search: req.user!.userId,
          page: 1,
          limit: 1,
        });
        res.status(200).json({
          status: 'ok',
          data: employee.data.filter((e) => e.userId === req.user!.userId),
          pagination: { total: 1, page: 1, limit: 1, totalPages: 1 },
        });
        return;
      }

      if (req.user!.role === 'manager') {
        // Manager is restricted to own department
        departmentIdFilter = req.user!.departmentId ?? undefined;
      } else if (pagination.departmentId) {
        // HR Admin can optionally filter by department
        departmentIdFilter = pagination.departmentId;
      }

      const result = await employeeService.listEmployees(companyId, {
        departmentId: departmentIdFilter,
        page: pagination.page,
        limit: pagination.limit,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
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

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getParam(req.params.id);
      const employee = await employeeService.getEmployeeById(id, req.user!.companyId);
      scopeToOwnEmployee(employee, req);

      res.status(200).json({
        status: 'ok',
        data: employee,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user!.role === 'employee') {
        throw new ForbiddenError('Employees cannot modify employee records', 'FORBIDDEN');
      }

      const id = getParam(req.params.id);
      const existing = await employeeService.getEmployeeById(id, req.user!.companyId);
      scopeToOwnEmployee(existing, req);

      const validated = updateEmployeeSchema.parse(req.body);
      const updated = await employeeService.updateEmployee(
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

  async updateTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const employeeId = getParam(req.params.id);
      const taskId = getParam(req.params.taskId);
      const existing = await employeeService.getEmployeeById(employeeId, req.user!.companyId);
      scopeToOwnEmployee(existing, req);

      const validated = updateEmployeeTaskSchema.parse(req.body);

      // If user is employee, they cannot reassign task assigneeType
      if (req.user!.role === 'employee' && validated.assigneeType !== undefined) {
        throw new ForbiddenError('Employees cannot reassign task ownership', 'FORBIDDEN');
      }

      const updatedTask = await employeeService.updateEmployeeTask(
        employeeId,
        taskId,
        validated,
        req.user!.companyId
      );

      res.status(200).json({
        status: 'ok',
        data: updatedTask,
      });
    } catch (error) {
      next(error);
    }
  }

  async getProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getParam(req.params.id);
      const employee = await employeeService.getEmployeeById(id, req.user!.companyId);
      scopeToOwnEmployee(employee, req);

      const progress = await employeeService.getEmployeeProgress(
        id,
        req.user!.companyId
      );

      res.status(200).json({
        status: 'ok',
        data: progress,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const employeeController = new EmployeeController();
export default employeeController;
