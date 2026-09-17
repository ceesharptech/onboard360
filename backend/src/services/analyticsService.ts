/**
 * Analytics Service.
 *
 * Computes real-time onboarding metrics from existing PostgreSQL data:
 * - Summary KPIs (% completion, total tasks, completed, overdue, avg time-to-complete)
 * - Department-level rollups
 * - Template-level completion & velocity
 * - Task-level breakdown & top overdue tasks
 *
 * Directives:
 * - Computed from real data — no synthetic metrics, no new tracking tables.
 * - Reuses employeeService.calculateProgress for consistent progress logic.
 * - Reflects BOTH template-originated tasks and ad-hoc tasks (source_template_task_id is null).
 */

import prisma from '../utils/prisma';
import employeeService from './employeeService';
import logger from '../utils/logger';

export interface DepartmentRollup {
  departmentId: string;
  departmentName: string;
  employeeCount: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  completionRate: number;
  percentComplete: number;
  averageTimeToCompleteDays: number;
  avgDaysToComplete: number;
}

export interface TemplateRollup {
  templateId: string;
  templateName: string;
  departmentId: string | null;
  assignedCount: number;
  assignedEmployeesCount: number;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  percentComplete: number;
  averageTimeToCompleteDays: number;
  avgDaysToComplete: number;
}

export interface TaskPerformance {
  title: string;
  taskTitle: string;
  category: string;
  assigneeType: string;
  totalAssigned: number;
  completedCount: number;
  overdueCount: number;
  averageTimeToCompleteDays: number;
  avgDaysToComplete: number;
}

export interface AnalyticsSummary {
  totalEmployees: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  overallCompletionRate: number;
  overallPercentComplete: number;
  averageTimeToCompleteDays: number;
  avgDaysToComplete: number;
}

export interface EmployeeAnalyticsItem {
  id: string;
  name: string;
  email: string;
  jobRole: string;
  department: {
    id: string;
    name: string;
  };
  progress: {
    totalTasks: number;
    completedTasks: number;
    percentComplete: number;
    overdueTasks: number;
  };
}

export interface AnalyticsData {
  summary: AnalyticsSummary;
  departments: DepartmentRollup[];
  departmentRollups: DepartmentRollup[];
  templates: TemplateRollup[];
  templateRollups: TemplateRollup[];
  topOverdueTasks: TaskPerformance[];
  taskAverages: TaskPerformance[];
  taskPerformance: TaskPerformance[];
  employees: EmployeeAnalyticsItem[];
  department?: {
    id: string;
    name: string;
  } | null;
}

export class AnalyticsService {
  /**
   * Get analytics for a company, optionally filtered by department.
   */
  async getCompanyAnalytics(
    companyId: string,
    options: { departmentId?: string } = {}
  ): Promise<AnalyticsData> {
    const departmentFilter = options.departmentId;

    // 1. Fetch departments in company
    const departments = await prisma.department.findMany({
      where: {
        companyId,
        ...(departmentFilter ? { id: departmentFilter } : {}),
      },
      orderBy: { name: 'asc' },
    });

    // 2. Fetch employees and all their tasks (both template and ad-hoc)
    const employees = await prisma.employee.findMany({
      where: {
        companyId,
        ...(departmentFilter ? { departmentId: departmentFilter } : {}),
      },
      include: {
        department: { select: { id: true, name: true } },
        tasks: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    // 3. Fetch template mapping for template-level aggregation
    const templateTasks = await prisma.onboardingTemplateTask.findMany({
      where: {
        template: { companyId },
      },
      select: {
        id: true,
        templateId: true,
        template: {
          select: { id: true, name: true, departmentId: true },
        },
      },
    });

    const templateTaskMap = new Map<
      string,
      { templateId: string; templateName: string; departmentId: string | null }
    >();
    for (const tt of templateTasks) {
      templateTaskMap.set(tt.id, {
        templateId: tt.templateId,
        templateName: tt.template.name,
        departmentId: tt.template.departmentId,
      });
    }

    // 4. Compute Summary Metrics & Task Details
    let totalCompanyTasks = 0;
    let totalCompanyCompleted = 0;
    let totalCompanyOverdue = 0;
    const allCompletionDurationsMs: number[] = [];

    // Per-department accumulators
    const deptMap = new Map<
      string,
      {
        departmentId: string;
        departmentName: string;
        employeeCount: number;
        totalTasks: number;
        completedTasks: number;
        overdueTasks: number;
        completionDurationsMs: number[];
      }
    >();

    for (const d of departments) {
      deptMap.set(d.id, {
        departmentId: d.id,
        departmentName: d.name,
        employeeCount: 0,
        totalTasks: 0,
        completedTasks: 0,
        overdueTasks: 0,
        completionDurationsMs: [],
      });
    }

    // Per-template accumulators
    const tempMap = new Map<
      string,
      {
        templateId: string;
        templateName: string;
        departmentId: string | null;
        employees: Set<string>;
        totalTasks: number;
        completedTasks: number;
        completionDurationsMs: number[];
      }
    >();

    // Per-task title accumulators
    const taskStatsMap = new Map<
      string,
      {
        title: string;
        category: string;
        assigneeType: string;
        totalAssigned: number;
        completedCount: number;
        overdueCount: number;
        completionDurationsMs: number[];
      }
    >();

    const now = new Date();

    // Iterate through all employees and their tasks
    for (const emp of employees) {
      // Use standard progress calculation
      const progress = employeeService.calculateProgress(emp.tasks);

      totalCompanyTasks += progress.totalTasks;
      totalCompanyCompleted += progress.completedTasks;
      totalCompanyOverdue += progress.overdueTasks;

      // Update department stats
      let deptStats = deptMap.get(emp.departmentId);
      if (!deptStats && emp.department) {
        deptStats = {
          departmentId: emp.department.id,
          departmentName: emp.department.name,
          employeeCount: 0,
          totalTasks: 0,
          completedTasks: 0,
          overdueTasks: 0,
          completionDurationsMs: [],
        };
        deptMap.set(emp.department.id, deptStats);
      }
      if (deptStats) {
        deptStats.employeeCount += 1;
        deptStats.totalTasks += progress.totalTasks;
        deptStats.completedTasks += progress.completedTasks;
        deptStats.overdueTasks += progress.overdueTasks;
      }

      // Process each individual task for duration & breakdowns
      for (const task of emp.tasks) {
        const isCompleted = task.status === 'completed';
        const isOverdue =
          !isCompleted && task.dueDate !== null && new Date(task.dueDate) < now;

        let durationMs: number | null = null;
        if (isCompleted && task.completedAt) {
          const createdAtTime = new Date(emp.createdAt).getTime();
          const completedTime = new Date(task.completedAt).getTime();
          durationMs = Math.max(0, completedTime - createdAtTime);
          allCompletionDurationsMs.push(durationMs);
          if (deptStats) {
            deptStats.completionDurationsMs.push(durationMs);
          }
        }

        // Template rollup mapping (if originated from template)
        if (task.sourceTemplateTaskId && templateTaskMap.has(task.sourceTemplateTaskId)) {
          const tmplInfo = templateTaskMap.get(task.sourceTemplateTaskId)!;
          let tmplStats = tempMap.get(tmplInfo.templateId);
          if (!tmplStats) {
            tmplStats = {
              templateId: tmplInfo.templateId,
              templateName: tmplInfo.templateName,
              departmentId: tmplInfo.departmentId,
              employees: new Set<string>(),
              totalTasks: 0,
              completedTasks: 0,
              completionDurationsMs: [],
            };
            tempMap.set(tmplInfo.templateId, tmplStats);
          }
          tmplStats.employees.add(emp.id);
          tmplStats.totalTasks += 1;
          if (isCompleted) {
            tmplStats.completedTasks += 1;
            if (durationMs !== null) {
              tmplStats.completionDurationsMs.push(durationMs);
            }
          }
        }

        // Task Title Performance (combines template & ad-hoc tasks)
        const taskKey = `${task.title}:::${task.category}`;
        let tStats = taskStatsMap.get(taskKey);
        if (!tStats) {
          tStats = {
            title: task.title,
            category: task.category,
            assigneeType: task.assigneeType,
            totalAssigned: 0,
            completedCount: 0,
            overdueCount: 0,
            completionDurationsMs: [],
          };
          taskStatsMap.set(taskKey, tStats);
        }
        tStats.totalAssigned += 1;
        if (isCompleted) {
          tStats.completedCount += 1;
          if (durationMs !== null) {
            tStats.completionDurationsMs.push(durationMs);
          }
        }
        if (isOverdue) {
          tStats.overdueCount += 1;
        }
      }
    }

    // Helper: calculate average days from array of durations in milliseconds
    const calcAvgDays = (durations: number[]): number => {
      if (durations.length === 0) return 0;
      const sum = durations.reduce((acc, curr) => acc + curr, 0);
      const avgMs = sum / durations.length;
      return Math.round((avgMs / (1000 * 60 * 60 * 24)) * 10) / 10;
    };

    // Calculate overall summary
    const overallCompletionRate =
      totalCompanyTasks > 0
        ? Math.round((totalCompanyCompleted / totalCompanyTasks) * 100)
        : 0;
    const avgDurationDays = calcAvgDays(allCompletionDurationsMs);

    const summary: AnalyticsSummary = {
      totalEmployees: employees.length,
      totalTasks: totalCompanyTasks,
      completedTasks: totalCompanyCompleted,
      overdueTasks: totalCompanyOverdue,
      overallCompletionRate,
      overallPercentComplete: overallCompletionRate,
      averageTimeToCompleteDays: avgDurationDays,
      avgDaysToComplete: avgDurationDays,
    };

    // Format department rollups
    const departmentRollups: DepartmentRollup[] = Array.from(deptMap.values()).map(
      (dept) => {
        const rate =
          dept.totalTasks > 0
            ? Math.round((dept.completedTasks / dept.totalTasks) * 100)
            : 0;
        const avgDays = calcAvgDays(dept.completionDurationsMs);
        return {
          departmentId: dept.departmentId,
          departmentName: dept.departmentName,
          employeeCount: dept.employeeCount,
          totalTasks: dept.totalTasks,
          completedTasks: dept.completedTasks,
          overdueTasks: dept.overdueTasks,
          completionRate: rate,
          percentComplete: rate,
          averageTimeToCompleteDays: avgDays,
          avgDaysToComplete: avgDays,
        };
      }
    );

    // Format template rollups
    const templateRollups: TemplateRollup[] = Array.from(tempMap.values()).map(
      (tmpl) => {
        const rate =
          tmpl.totalTasks > 0
            ? Math.round((tmpl.completedTasks / tmpl.totalTasks) * 100)
            : 0;
        const avgDays = calcAvgDays(tmpl.completionDurationsMs);
        return {
          templateId: tmpl.templateId,
          templateName: tmpl.templateName,
          departmentId: tmpl.departmentId,
          assignedCount: tmpl.employees.size,
          assignedEmployeesCount: tmpl.employees.size,
          totalTasks: tmpl.totalTasks,
          completedTasks: tmpl.completedTasks,
          completionRate: rate,
          percentComplete: rate,
          averageTimeToCompleteDays: avgDays,
          avgDaysToComplete: avgDays,
        };
      }
    );

    // Format task averages
    const allTaskStats: TaskPerformance[] = Array.from(taskStatsMap.values()).map(
      (t) => {
        const avgDays = calcAvgDays(t.completionDurationsMs);
        return {
          title: t.title,
          taskTitle: t.title,
          category: t.category,
          assigneeType: t.assigneeType,
          totalAssigned: t.totalAssigned,
          completedCount: t.completedCount,
          overdueCount: t.overdueCount,
          averageTimeToCompleteDays: avgDays,
          avgDaysToComplete: avgDays,
        };
      }
    );

    // Top overdue tasks (sorted descending by overdue count, min 1 overdue)
    const topOverdueTasks = allTaskStats
      .filter((t) => t.overdueCount > 0)
      .sort((a, b) => b.overdueCount - a.overdueCount)
      .slice(0, 10);

    // Task averages sorted by completion rate / count
    const taskAverages = allTaskStats
      .sort((a, b) => b.totalAssigned - a.totalAssigned)
      .slice(0, 15);

    // Employee items for roster
    const employeeItems: EmployeeAnalyticsItem[] = employees.map((emp) => {
      const progress = employeeService.calculateProgress(emp.tasks);
      return {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        jobRole: emp.jobRole,
        department: {
          id: emp.department?.id || emp.departmentId,
          name: emp.department?.name || 'Unassigned',
        },
        progress: {
          totalTasks: progress.totalTasks,
          completedTasks: progress.completedTasks,
          percentComplete: progress.percentComplete,
          overdueTasks: progress.overdueTasks,
        },
      };
    });

    // Selected department if filtered
    const selectedDeptObj = departmentFilter
      ? {
          id: departments[0]?.id || departmentFilter,
          name: departments[0]?.name || '',
        }
      : null;

    logger.info(
      {
        companyId,
        departmentFilter,
        totalEmployees: summary.totalEmployees,
        totalTasks: summary.totalTasks,
      },
      'Generated onboarding analytics'
    );

    return {
      summary,
      departments: departmentRollups,
      departmentRollups,
      templates: templateRollups,
      templateRollups,
      topOverdueTasks,
      taskAverages,
      taskPerformance: allTaskStats,
      employees: employeeItems,
      department: selectedDeptObj,
    };
  }

  /**
   * Get analytics scoped strictly to a single department (for Manager view).
   */
  async getDepartmentAnalytics(companyId: string, departmentId: string): Promise<AnalyticsData> {
    return this.getCompanyAnalytics(companyId, { departmentId });
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;
