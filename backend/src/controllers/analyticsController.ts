/**
 * Analytics Controller.
 *
 * Exposes endpoints for onboarding analytics:
 * - HR Admin: Company-wide analytics, optionally filterable by department.
 * - Manager: Scoped strictly to their own department.
 * - Employee: Forbidden (403).
 */

import { Request, Response, NextFunction } from 'express';
import analyticsService from '../services/analyticsService';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import prisma from '../utils/prisma';

export class AnalyticsController {
  async getAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const requestedDeptId =
        typeof req.query.departmentId === 'string' && req.query.departmentId.trim() !== ''
          ? req.query.departmentId.trim()
          : undefined;

      if (user.role === 'employee') {
        throw new ForbiddenError('Employees are not authorized to view analytics', 'FORBIDDEN');
      }

      if (user.role === 'manager') {
        if (!user.departmentId) {
          throw new ForbiddenError('Manager is not assigned to a department', 'FORBIDDEN');
        }

        // If manager requests a different department, reject with 403
        if (requestedDeptId && requestedDeptId !== user.departmentId) {
          throw new ForbiddenError(
            'Managers can only view analytics for their own department',
            'FORBIDDEN'
          );
        }

        const data = await analyticsService.getDepartmentAnalytics(
          user.companyId,
          user.departmentId
        );

        res.status(200).json({
          status: 'ok',
          data,
        });
        return;
      }

      // HR Admin role: company-wide, with optional department filter
      if (requestedDeptId) {
        // Validate department belongs to company
        const dept = await prisma.department.findFirst({
          where: { id: requestedDeptId, companyId: user.companyId },
        });

        if (!dept) {
          throw new NotFoundError('Department not found in company', 'NOT_FOUND');
        }
      }

      const data = await analyticsService.getCompanyAnalytics(user.companyId, {
        departmentId: requestedDeptId,
      });

      res.status(200).json({
        status: 'ok',
        data,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const analyticsController = new AnalyticsController();
export default analyticsController;
