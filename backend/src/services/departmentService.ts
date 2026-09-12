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

    return mentors;
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
