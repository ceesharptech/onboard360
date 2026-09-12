import prisma from '../utils/prisma';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { CreateEmployeeInput, UpdateEmployeeInput, UpdateEmployeeTaskInput } from '../utils/validation';
import mentorService from './mentorService';
import logger from '../utils/logger';

export interface ProgressSummary {
  totalTasks: number;
  completedTasks: number;
  percentComplete: number;
  overdueTasks: number;
}

export class EmployeeService {
  /**
   * Helper to calculate progress summary from task array.
   */
  calculateProgress(tasks: { status: string; dueDate: Date | null }[]): ProgressSummary {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'completed').length;
    const percentComplete = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const now = new Date();
    const overdueTasks = tasks.filter(
      (t) => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < now
    ).length;

    return {
      totalTasks,
      completedTasks,
      percentComplete,
      overdueTasks,
    };
  }

  /**
   * Create an employee with auto-matched onboarding template tasks snapshot and mentor assignment.
   *
   * Snapshot-on-assignment is a strict invariant:
   * When an employee is created, matched template tasks are cloned into employee_tasks.
   * Editing or deleting the template later will never alter existing employee_tasks.
   */
  async createEmployee(data: CreateEmployeeInput, companyId: string) {
    const department = await prisma.department.findFirst({
      where: { id: data.departmentId, companyId },
    });

    if (!department) {
      throw new NotFoundError('Department not found in company', 'NOT_FOUND');
    }

    // 1. Template matching with fallback
    // Try exact role + department match
    let matchedTemplate = await prisma.onboardingTemplate.findFirst({
      where: {
        companyId,
        departmentId: data.departmentId,
        jobRole: { equals: data.jobRole, mode: 'insensitive' },
      },
      include: {
        tasks: { orderBy: { orderIndex: 'asc' } },
      },
    });

    // Fallback 1: department-level default template
    if (!matchedTemplate) {
      matchedTemplate = await prisma.onboardingTemplate.findFirst({
        where: {
          companyId,
          departmentId: data.departmentId,
          isDefault: true,
        },
        include: {
          tasks: { orderBy: { orderIndex: 'asc' } },
        },
      });
    }

    // Fallback 2: company-level default template (any department)
    if (!matchedTemplate) {
      matchedTemplate = await prisma.onboardingTemplate.findFirst({
        where: {
          companyId,
          isDefault: true,
        },
        include: {
          tasks: { orderBy: { orderIndex: 'asc' } },
        },
      });
    }

    // 2. Mentor assignment (round-robin / least-loaded from department pool unless specified)
    let assignedMentorId: string | null = data.mentorId ?? null;
    if (!assignedMentorId) {
      assignedMentorId = await mentorService.assignLeastLoadedMentor(data.departmentId, companyId);
    }

    // 3. Check if user already exists for this email
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });
    const userId = existingUser && existingUser.companyId === companyId ? existingUser.id : null;

    const startDate = new Date(data.startDate);

    // 4. Create Employee and snapshot tasks in an atomic transaction
    const employee = await prisma.$transaction(async (tx) => {
      const newEmployee = await tx.employee.create({
        data: {
          companyId,
          userId,
          name: data.name,
          email: data.email,
          departmentId: data.departmentId,
          jobRole: data.jobRole,
          startDate,
          managerId: data.managerId ?? null,
          employmentType: data.employmentType,
          mentorId: assignedMentorId,
        },
      });

      // Snapshot tasks if matched template exists
      if (matchedTemplate && matchedTemplate.tasks.length > 0) {
        const employeeTasksData = matchedTemplate.tasks.map((task) => {
          const dueDate = new Date(startDate.getTime() + task.dueOffsetDays * 86400000);
          return {
            employeeId: newEmployee.id,
            title: task.title,
            description: task.description,
            category: task.category,
            orderIndex: task.orderIndex,
            assigneeType: task.assigneeType,
            dueDate,
            status: 'pending',
            sourceTemplateTaskId: task.id, // For traceability only, no live FK
          };
        });

        await tx.employeeTask.createMany({
          data: employeeTasksData,
        });
      }

      return newEmployee;
    });

    logger.info(
      {
        employeeId: employee.id,
        matchedTemplateId: matchedTemplate?.id ?? null,
        mentorId: assignedMentorId,
      },
      'Created employee with snapshotted onboarding tasks'
    );

    return this.getEmployeeById(employee.id, companyId);
  }

  /**
   * List employees with pagination and calculated progress.
   */
  async listEmployees(
    companyId: string,
    options: {
      departmentId?: string | null;
      page?: number;
      limit?: number;
      search?: string;
    } = {}
  ) {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? options.limit : 20;
    const skip = (page - 1) * limit;

    const where: any = { companyId };
    if (options.departmentId) {
      where.departmentId = options.departmentId;
    }
    if (options.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { email: { contains: options.search, mode: 'insensitive' } },
        { jobRole: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [total, employees] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          department: { select: { id: true, name: true } },
          tasks: { select: { id: true, status: true, dueDate: true } },
          user: { select: { id: true, email: true, role: true } },
        },
      }),
    ]);

    // Fetch mentor user details if mentorId is present
    const mentorIds = employees.map((e) => e.mentorId).filter((id): id is string => Boolean(id));
    const mentors = await prisma.mentor.findMany({
      where: { id: { in: mentorIds } },
      include: { user: { select: { id: true, email: true } } },
    });
    const mentorMap = new Map(mentors.map((m) => [m.id, m]));

    const enrichedEmployees = employees.map((emp) => {
      const progress = this.calculateProgress(emp.tasks);
      const mentor = emp.mentorId ? mentorMap.get(emp.mentorId) ?? null : null;
      return {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        jobRole: emp.jobRole,
        startDate: emp.startDate,
        employmentType: emp.employmentType,
        departmentId: emp.departmentId,
        department: emp.department,
        userId: emp.userId,
        managerId: emp.managerId,
        mentorId: emp.mentorId,
        mentor: mentor ? { id: mentor.id, email: mentor.user.email } : null,
        createdAt: emp.createdAt,
        progress,
      };
    });

    return {
      data: enrichedEmployees,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single employee with all snapshotted tasks.
   */
  async getEmployeeById(id: string, companyId: string) {
    const employee = await prisma.employee.findFirst({
      where: { id, companyId },
      include: {
        department: { select: { id: true, name: true } },
        tasks: { orderBy: { orderIndex: 'asc' } },
        user: { select: { id: true, email: true, role: true } },
      },
    });

    if (!employee) {
      throw new NotFoundError('Employee not found', 'NOT_FOUND');
    }

    let mentor: { id: string; email: string } | null = null;
    if (employee.mentorId) {
      const mentorRecord = await prisma.mentor.findFirst({
        where: { id: employee.mentorId },
        include: { user: { select: { id: true, email: true } } },
      });
      if (mentorRecord) {
        mentor = { id: mentorRecord.id, email: mentorRecord.user.email };
      }
    }

    const progress = this.calculateProgress(employee.tasks);

    return {
      ...employee,
      mentor,
      progress,
    };
  }

  /**
   * Update employee details (e.g. reassign mentor, update job role or employment type).
   */
  async updateEmployee(id: string, data: UpdateEmployeeInput, companyId: string) {
    const existing = await prisma.employee.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundError('Employee not found', 'NOT_FOUND');
    }

    if (data.departmentId && data.departmentId !== existing.departmentId) {
      const dept = await prisma.department.findFirst({
        where: { id: data.departmentId, companyId },
      });
      if (!dept) {
        throw new NotFoundError('Department not found', 'NOT_FOUND');
      }
    }

    // If mentor is reassigned, handle mentee count adjustments
    if (data.mentorId !== undefined && data.mentorId !== existing.mentorId) {
      if (existing.mentorId) {
        await prisma.mentor.updateMany({
          where: { id: existing.mentorId, currentMenteeCount: { gt: 0 } },
          data: { currentMenteeCount: { decrement: 1 } },
        });
      }
      if (data.mentorId) {
        const newMentor = await prisma.mentor.findFirst({
          where: { id: data.mentorId, companyId },
        });
        if (!newMentor) {
          throw new NotFoundError('Mentor not found', 'NOT_FOUND');
        }
        await prisma.mentor.update({
          where: { id: data.mentorId },
          data: { currentMenteeCount: { increment: 1 } },
        });
      }
    }

    await prisma.employee.update({
      where: { id },
      data: {
        name: data.name ?? undefined,
        jobRole: data.jobRole ?? undefined,
        departmentId: data.departmentId ?? undefined,
        managerId: data.managerId !== undefined ? data.managerId : undefined,
        mentorId: data.mentorId !== undefined ? data.mentorId : undefined,
        employmentType: data.employmentType ?? undefined,
      },
    });

    return this.getEmployeeById(id, companyId);
  }

  /**
   * Update an employee task (status toggling, completion timestamp, reassignment).
   */
  async updateEmployeeTask(
    employeeId: string,
    taskId: string,
    data: UpdateEmployeeTaskInput,
    companyId: string
  ) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId },
    });

    if (!employee) {
      throw new NotFoundError('Employee not found', 'NOT_FOUND');
    }

    const task = await prisma.employeeTask.findFirst({
      where: { id: taskId, employeeId },
    });

    if (!task) {
      throw new NotFoundError('Task not found', 'NOT_FOUND');
    }

    const updatePayload: any = {};
    if (data.status !== undefined) {
      updatePayload.status = data.status;
      if (data.status === 'completed') {
        updatePayload.completedAt = new Date();
      } else {
        updatePayload.completedAt = null;
      }
    }

    if (data.assigneeType !== undefined) {
      updatePayload.assigneeType = data.assigneeType;
    }

    const updatedTask = await prisma.employeeTask.update({
      where: { id: taskId },
      data: updatePayload,
    });

    logger.info({ employeeId, taskId, status: updatedTask.status }, 'Updated employee task');
    return updatedTask;
  }

  /**
   * Get progress statistics for an employee.
   */
  async getEmployeeProgress(employeeId: string, companyId: string): Promise<ProgressSummary> {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      include: {
        tasks: { select: { status: true, dueDate: true } },
      },
    });

    if (!employee) {
      throw new NotFoundError('Employee not found', 'NOT_FOUND');
    }

    return this.calculateProgress(employee.tasks);
  }
}

export const employeeService = new EmployeeService();
export default employeeService;
