import prisma from '../utils/prisma';
import { NotFoundError, BadRequestError } from '../utils/errors';
import logger from '../utils/logger';

export class DepartmentService {
  /**
   * List all departments within the authenticated user's company.
   */
  async listDepartments(companyId: string) {
    return prisma.department.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            employees: true,
            mentors: { where: { isActive: true } },
          },
        },
      },
    });
  }

  /**
   * Get all mentors in a department's mentor pool with their mentee counts.
   */
  async getDepartmentMentors(departmentId: string, companyId: string) {
    const department = await prisma.department.findFirst({
      where: { id: departmentId, companyId },
    });

    if (!department) {
      throw new NotFoundError('Department not found', 'NOT_FOUND');
    }

    const mentors = await prisma.mentor.findMany({
      where: {
        departmentId,
        companyId,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: [{ currentMenteeCount: 'asc' }, { id: 'asc' }],
    });

    const mentorIds = mentors.map((m) => m.id);
    const mentees = await prisma.employee.findMany({
      where: {
        companyId,
        mentorId: { in: mentorIds },
      },
      select: {
        id: true,
        name: true,
        jobRole: true,
        startDate: true,
        departmentId: true,
        department: { select: { id: true, name: true } },
        mentorId: true,
        tasks: { select: { status: true, dueDate: true } },
      },
    });

    const menteesByMentorId = new Map<string, any[]>();
    for (const mentee of mentees) {
      if (!mentee.mentorId) continue;
      const list = menteesByMentorId.get(mentee.mentorId) || [];
      const totalTasks = mentee.tasks.length;
      const completedTasks = mentee.tasks.filter((t) => t.status === 'completed').length;
      const percentComplete = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      list.push({
        id: mentee.id,
        name: mentee.name,
        jobRole: mentee.jobRole,
        startDate: mentee.startDate,
        department: mentee.department,
        progress: {
          totalTasks,
          completedTasks,
          percentComplete,
        },
      });
      menteesByMentorId.set(mentee.mentorId, list);
    }

    return mentors.map((m) => ({
      ...m,
      mentees: menteesByMentorId.get(m.id) || [],
    }));
  }

  /**
   * Add a user to a department's mentor pool.
   */
  async addMentorToPool(departmentId: string, userId: string, companyId: string) {
    const department = await prisma.department.findFirst({
      where: { id: departmentId, companyId },
    });

    if (!department) {
      throw new NotFoundError('Department not found', 'NOT_FOUND');
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, companyId },
    });

    if (!user) {
      throw new NotFoundError('User not found in company', 'NOT_FOUND');
    }

    // Check if mentor already exists
    const existing = await prisma.mentor.findFirst({
      where: {
        companyId,
        departmentId,
        userId,
      },
    });

    if (existing) {
      if (existing.isActive) {
        throw new BadRequestError('User is already an active mentor in this department', 'ALREADY_EXISTS');
      }
      return prisma.mentor.update({
        where: { id: existing.id },
        data: { isActive: true },
        include: { user: { select: { id: true, email: true, role: true } } },
      });
    }

    const mentor = await prisma.mentor.create({
      data: {
        companyId,
        departmentId,
        userId,
        isActive: true,
        currentMenteeCount: 0,
      },
      include: { user: { select: { id: true, email: true, role: true } } },
    });

    logger.info({ mentorId: mentor.id, departmentId, userId }, 'Added mentor to department pool');
    return mentor;
  }

  /**
   * Deactivate/remove a mentor from a department's pool.
   */
  async removeMentorFromPool(departmentId: string, mentorId: string, companyId: string) {
    const mentor = await prisma.mentor.findFirst({
      where: { id: mentorId, departmentId, companyId },
    });

    if (!mentor) {
      throw new NotFoundError('Mentor not found in department', 'NOT_FOUND');
    }

    await prisma.mentor.update({
      where: { id: mentorId },
      data: { isActive: false },
    });

    logger.info({ mentorId, departmentId }, 'Removed mentor from department pool');
    return { success: true };
  }
}

export const departmentService = new DepartmentService();
export default departmentService;
