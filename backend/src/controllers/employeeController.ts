import { Request, Response, NextFunction } from 'express';
import employeeService from '../services/employeeService';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  updateEmployeeTaskSchema,
  createAdHocTaskSchema,
  paginationQuerySchema,
  employeeListQuerySchema,
} from '../utils/validation';
import { scopeToOwnEmployee, scopeToDepartment } from '../middleware/auth';
import prisma from '../utils/prisma';
import { ForbiddenError, NotFoundError } from '../utils/errors';

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
      const query = employeeListQuerySchema.parse(req.query);

      let departmentIdFilter: string | undefined;

      if (req.user!.role === 'employee') {
        // Employee can only list their own employee record
        let employee = await employeeService.listEmployees(companyId, {
          userId: req.user!.userId,
          page: 1,
          limit: 1,
        });

        const userEmail = req.user?.email;
        if (employee.data.length === 0 && userEmail) {
          const byEmail = await employeeService.listEmployees(companyId, {
            search: userEmail,
            page: 1,
            limit: 1,
          });
          const matched = byEmail.data.filter(
            (e) => e.email.toLowerCase() === userEmail.toLowerCase()
          );
          if (matched.length > 0) {
            await prisma.employee.update({
              where: { id: matched[0].id },
              data: { userId: req.user!.userId },
            });
            matched[0].userId = req.user!.userId;
            employee = {
              data: matched,
              pagination: {
                total: matched.length,
                page: 1,
                limit: 1,
                totalPages: 1,
                hasNextPage: false,
                hasPrevPage: false,
              },
            };
          }
        }

        res.status(200).json({
          status: 'ok',
          data: employee.data,
          pagination: employee.pagination,
        });
        return;
      }

      if (req.user!.role === 'manager') {
        // Manager is restricted to own department
        departmentIdFilter = req.user!.departmentId ?? undefined;
      } else if (query.departmentId) {
        // HR Admin can optionally filter by department
        departmentIdFilter = query.departmentId;
      }

      const result = await employeeService.listEmployees(companyId, {
        departmentId: departmentIdFilter,
        page: query.page,
        limit: query.limit,
        search: query.search,
        status: query.status,
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

  async getMyManagerTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tasks = await employeeService.getMyAssignedManagerTasks(
        req.user!.userId,
        req.user!.companyId
      );
      res.status(200).json({
        status: 'ok',
        data: tasks,
      });
    } catch (error) {
      next(error);
    }
  }

  async getMyMentees(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await employeeService.getMyMenteeData(
        req.user!.userId,
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

  async updateTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const employeeId = getParam(req.params.id);
      const taskId = getParam(req.params.taskId);
      const existing = await employeeService.getEmployeeById(employeeId, req.user!.companyId);

      // Verify company scope
      if (existing.companyId !== req.user!.companyId) {
        throw new NotFoundError('Resource not found', 'NOT_FOUND');
      }

      const targetTask = existing.tasks.find((t) => t.id === taskId);
      if (!targetTask) {
        throw new NotFoundError('Resource not found', 'NOT_FOUND');
      }

      const validated = updateEmployeeTaskSchema.parse(req.body);

      // Scoping rules for task updates:
      const isOwnRecord = existing.userId === req.user!.userId;
      const isAssignedMentor = existing.mentor?.userId === req.user!.userId;
      const isOwnDepartment =
        req.user!.role === 'manager' && req.user!.departmentId === existing.departmentId;

      if (req.user!.role === 'employee') {
        // Employees cannot reassign task ownership
        if (validated.assigneeType !== undefined) {
          throw new ForbiddenError('Employees cannot reassign task ownership', 'FORBIDDEN');
        }

        if (!isOwnRecord && !isAssignedMentor) {
          throw new NotFoundError('Resource not found', 'NOT_FOUND');
        }

        if (isAssignedMentor && !isOwnRecord) {
          // Mentor can only update tasks assigned to 'mentor' for other employees
          if (targetTask.assigneeType !== 'mentor') {
            throw new NotFoundError('Resource not found', 'NOT_FOUND');
          }
        }
      } else if (req.user!.role === 'manager') {
        if (!isOwnDepartment && !isAssignedMentor) {
          throw new NotFoundError('Resource not found', 'NOT_FOUND');
        }

        if (!isOwnDepartment && isAssignedMentor) {
          if (targetTask.assigneeType !== 'mentor') {
            throw new NotFoundError('Resource not found', 'NOT_FOUND');
          }
        }
      }
      // hr_admin has company-wide access

      // Enforce assigneeType matching specifically when toggling task completion status:
      if (validated.status !== undefined) {
        if (targetTask.assigneeType === 'employee') {
          // Only the employee the task belongs to may toggle it
          if (!isOwnRecord) {
            throw new ForbiddenError(
              'Only the assigned employee can mark this task complete',
              'WRONG_ASSIGNEE_TYPE'
            );
          }
        } else if (targetTask.assigneeType === 'manager') {
          // Only that employee's department manager may toggle it
          if (!isOwnDepartment) {
            throw new ForbiddenError(
              'Only the assigned manager can mark this task complete',
              'WRONG_ASSIGNEE_TYPE'
            );
          }
        } else if (targetTask.assigneeType === 'mentor') {
          // Only the employee's assigned mentor may toggle it
          if (!isAssignedMentor) {
            throw new ForbiddenError(
              'Only the assigned mentor can mark this task complete',
              'WRONG_ASSIGNEE_TYPE'
            );
          }
        }
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

  async createAdHocTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getParam(req.params.id);
      const validated = createAdHocTaskSchema.parse(req.body);

      // Verify employee exists in company
      const employee = await prisma.employee.findFirst({
        where: { id, companyId: req.user!.companyId },
      });

      if (!employee) {
        throw new NotFoundError('Employee not found', 'NOT_FOUND');
      }

      // Enforce department scope for managers (HR Admin bypasses)
      scopeToDepartment(employee.departmentId, req);

      const task = await employeeService.createAdHocTask(id, validated, req.user!.companyId);

      res.status(201).json({
        status: 'ok',
        data: task,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const employeeController = new EmployeeController();
export default employeeController;
