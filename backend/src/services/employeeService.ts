import prisma from '../utils/prisma';
import { NotFoundError, BadRequestError } from '../utils/errors';
import {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  UpdateEmployeeTaskInput,
  CreateAdHocTaskInput,
} from '../utils/validation';
import mentorService from './mentorService';
import logger from '../utils/logger';
import { hashPassword } from '../utils/password';

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
   * Create an employee or HR Admin with auto-matched onboarding template tasks snapshot and mentor assignment.
   *
   * Snapshot-on-assignment is a strict invariant:
   * When an employee is created, matched template tasks are cloned into employee_tasks.
   * Editing or deleting the template later will never alter existing employee_tasks.
   */
  async createEmployee(data: CreateEmployeeInput, companyId: string) {
    // Handle hr_admin creation
    if (data.role === 'hr_admin') {
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });
      if (existingUser) {
        throw new BadRequestError('User with this email already exists', 'EMAIL_ALREADY_EXISTS');
      }

      const passwordHash = await hashPassword(data.initialPassword || 'TempPass123!');
      const newUser = await prisma.user.create({
        data: {
          email: data.email,
          passwordHash,
          role: 'hr_admin',
          companyId,
          departmentId: null,
          mustChangePassword: true,
        },
      });

      logger.info({ userId: newUser.id, companyId }, 'Created HR Admin user');

      return {
        id: newUser.id,
        userId: newUser.id,
        name: data.name,
        email: data.email,
        role: 'hr_admin',
        departmentId: null,
        department: null,
        jobRole: 'HR Administrator',
        startDate: null,
        employmentType: null,
        tasks: [],
        progress: { totalTasks: 0, completedTasks: 0, percentComplete: 0, overdueTasks: 0 },
        user: { id: newUser.id, email: newUser.email, role: newUser.role },
        mentor: null,
        mustChangePassword: true,
      };
    }

    if (!data.departmentId) {
      throw new BadRequestError('Department is required for managers and employees', 'BAD_REQUEST');
    }

    const department = await prisma.department.findFirst({
      where: { id: data.departmentId, companyId },
    });

    if (!department) {
      throw new NotFoundError('Department not found in company', 'NOT_FOUND');
    }

    // Validate managerId if provided (must be an existing user in same company with role='manager')
    if (data.managerId) {
      const managerUser = await prisma.user.findFirst({
        where: {
          id: data.managerId,
          companyId,
          role: 'manager',
        },
      });

      if (!managerUser) {
        throw new BadRequestError(
          'Selected manager must be an existing user with the manager role in the company',
          'INVALID_MANAGER'
        );
      }
    }

    // 1. Template selection: explicit templateId override OR automatic template matching with fallback
    let matchedTemplate: any = null;

    if (data.templateId) {
      matchedTemplate = await prisma.onboardingTemplate.findFirst({
        where: {
          id: data.templateId,
          companyId,
        },
        include: {
          tasks: { orderBy: { orderIndex: 'asc' } },
        },
      });

      if (!matchedTemplate) {
        throw new NotFoundError('Selected onboarding template not found in company', 'NOT_FOUND');
      }
    } else {
      // Automatic template matching (Phase 2 behavior)
      // Try exact role + department match
      matchedTemplate = await prisma.onboardingTemplate.findFirst({
        where: {
          companyId,
          departmentId: data.departmentId,
          jobRole: data.jobRole ? { equals: data.jobRole, mode: 'insensitive' } : undefined,
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
    }

    // 2. Mentor assignment (round-robin / least-loaded from department pool unless specified)
    let assignedMentorId: string | null = data.mentorId ?? null;
    if (!assignedMentorId) {
      assignedMentorId = await mentorService.assignLeastLoadedMentor(data.departmentId, companyId);
    }

    // 3. User account creation / linking
    let user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (user && user.companyId !== companyId) {
      throw new BadRequestError('User with this email belongs to another company', 'EMAIL_ALREADY_EXISTS');
    }

    if (!user) {
      const passwordHash = await hashPassword(data.initialPassword || 'TempPass123!');
      user = await prisma.user.create({
        data: {
          email: data.email,
          passwordHash,
          role: data.role || 'employee',
          companyId,
          departmentId: data.departmentId,
          mustChangePassword: true,
        },
      });
    }

    const startDate = data.startDate ? new Date(data.startDate) : new Date();

    // 4. Create Employee and snapshot tasks in an atomic transaction
    const employee = await prisma.$transaction(async (tx) => {
      const newEmployee = await tx.employee.create({
        data: {
          companyId,
          userId: user?.id ?? null,
          name: data.name,
          email: data.email,
          departmentId: data.departmentId!,
          jobRole: data.jobRole || 'Team Member',
          startDate,
          managerId: data.managerId ?? null,
          employmentType: data.employmentType || 'full_time',
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
            taskUrl: task.taskUrl ?? null,
            relatedDocumentId: task.relatedDocumentId ?? null,
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
      userId?: string;
      page?: number;
      limit?: number;
      search?: string;
      status?: 'not_started' | 'in_progress' | 'complete' | 'overdue';
    } = {}
  ) {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = Math.min(options.limit && options.limit > 0 ? options.limit : 20, 100);
    const skip = (page - 1) * limit;

    const where: any = { companyId };
    if (options.departmentId) {
      where.departmentId = options.departmentId;
    }
    if (options.userId) {
      where.userId = options.userId;
    }
    if (options.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { email: { contains: options.search, mode: 'insensitive' } },
        { jobRole: { contains: options.search, mode: 'insensitive' } },
      ];
    }
    if (options.status) {
      const now = new Date();
      if (options.status === 'overdue') {
        where.tasks = {
          some: {
            status: { not: 'completed' },
            dueDate: { lt: now },
          },
        };
      } else if (options.status === 'complete') {
        where.tasks = {
          none: {
            status: { not: 'completed' },
          },
          some: {},
        };
      } else if (options.status === 'in_progress') {
        where.AND = where.AND || [];
        where.AND.push(
          { tasks: { some: { status: 'completed' } } },
          { tasks: { some: { status: { not: 'completed' } } } }
        );
      } else if (options.status === 'not_started') {
        where.tasks = {
          none: {
            status: 'completed',
          },
        };
      }
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

    // Fetch manager user details if managerId is present
    const managerIds = employees.map((e) => e.managerId).filter((id): id is string => Boolean(id));
    const managers = await prisma.user.findMany({
      where: { id: { in: managerIds }, companyId },
      select: { id: true, email: true },
    });
    const managerMap = new Map(managers.map((m) => [m.id, m]));

    const enrichedEmployees = employees.map((emp) => {
      const progress = this.calculateProgress(emp.tasks);
      const mentor = emp.mentorId ? mentorMap.get(emp.mentorId) ?? null : null;
      const manager = emp.managerId ? managerMap.get(emp.managerId) ?? null : null;
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
        manager: manager ? { id: manager.id, email: manager.email } : null,
        mentorId: emp.mentorId,
        mentor: mentor ? { id: mentor.id, email: mentor.user.email } : null,
        createdAt: emp.createdAt,
        progress,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: enrichedEmployees,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
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
        tasks: {
          orderBy: { orderIndex: 'asc' },
          include: {
            relatedDocument: {
              select: { id: true, filename: true, departmentId: true },
            },
          },
        },
        user: { select: { id: true, email: true, role: true } },
      },
    });

    if (!employee) {
      throw new NotFoundError('Employee not found', 'NOT_FOUND');
    }

    let mentor: { id: string; email: string; userId?: string } | null = null;
    if (employee.mentorId) {
      const mentorRecord = await prisma.mentor.findFirst({
        where: { id: employee.mentorId },
        include: { user: { select: { id: true, email: true } } },
      });
      if (mentorRecord) {
        mentor = { id: mentorRecord.id, email: mentorRecord.user.email, userId: mentorRecord.userId };
      }
    }

    let manager: { id: string; email: string } | null = null;
    if (employee.managerId) {
      const managerUser = await prisma.user.findFirst({
        where: { id: employee.managerId, companyId },
        select: { id: true, email: true },
      });
      if (managerUser) {
        manager = { id: managerUser.id, email: managerUser.email };
      }
    }

    const progress = this.calculateProgress(employee.tasks);

    return {
      ...employee,
      manager,
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

    if (data.managerId !== undefined && data.managerId !== null) {
      const managerUser = await prisma.user.findFirst({
        where: { id: data.managerId, companyId, role: 'manager' },
      });
      if (!managerUser) {
        throw new BadRequestError(
          'Selected manager must be an existing user with the manager role in the company',
          'INVALID_MANAGER'
        );
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

  /**
   * Get tasks assigned to 'manager' for employees in the manager's department.
   */
  async getMyAssignedManagerTasks(managerUserId: string, companyId: string) {
    const user = await prisma.user.findFirst({
      where: { id: managerUserId, companyId },
    });

    if (!user || !user.departmentId) {
      return [];
    }

    const tasks = await prisma.employeeTask.findMany({
      where: {
        assigneeType: 'manager',
        employee: {
          companyId,
          departmentId: user.departmentId,
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            jobRole: true,
            email: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { orderIndex: 'asc' }],
    });

    return tasks;
  }

  /**
   * Get active mentee data for an employee or manager who is an active mentor.
   */
  async getMyMenteeData(userId: string, companyId: string) {
    const activeMentors = await prisma.mentor.findMany({
      where: {
        userId,
        companyId,
        isActive: true,
      },
    });

    if (activeMentors.length === 0) {
      return {
        isMentor: false,
        mentees: [],
      };
    }

    const mentorIds = activeMentors.map((m) => m.id);
    const mentees = await prisma.employee.findMany({
      where: {
        companyId,
        mentorId: { in: mentorIds },
      },
      include: {
        department: { select: { id: true, name: true } },
        tasks: { orderBy: { orderIndex: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const enrichedMentees = mentees.map((emp) => {
      const progress = this.calculateProgress(emp.tasks);
      const mentorTasks = emp.tasks.filter((t) => t.assigneeType === 'mentor');

      return {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        jobRole: emp.jobRole,
        startDate: emp.startDate,
        department: emp.department,
        progress,
        mentorTasks,
        tasks: emp.tasks,
      };
    });

    return {
      isMentor: true,
      mentees: enrichedMentees,
    };
  }

  /**
   * Assign an ad-hoc task to an employee (additive, no source_template_task_id).
   */
  async createAdHocTask(employeeId: string, input: CreateAdHocTaskInput, companyId: string) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId },
    });

    if (!employee) {
      throw new NotFoundError('Employee not found', 'NOT_FOUND');
    }

    // Determine next orderIndex
    const lastTask = await prisma.employeeTask.findFirst({
      where: { employeeId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });

    const nextOrderIndex = lastTask ? lastTask.orderIndex + 1 : 0;

    const task = await prisma.employeeTask.create({
      data: {
        employeeId,
        title: input.title,
        description: input.description ?? null,
        category: input.category || 'General',
        orderIndex: nextOrderIndex,
        assigneeType: input.assigneeType,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        status: 'pending',
        completedAt: null,
        sourceTemplateTaskId: null,
        taskUrl: input.taskUrl ?? null,
        relatedDocumentId: input.relatedDocumentId ?? null,
      },
      include: {
        relatedDocument: {
          select: { id: true, filename: true, departmentId: true },
        },
      },
    });

    logger.info(
      { employeeId, taskId: task.id, title: task.title, assigneeType: task.assigneeType },
      'Ad-hoc task created for employee'
    );

    return task;
  }
}

export const employeeService = new EmployeeService();
export default employeeService;
