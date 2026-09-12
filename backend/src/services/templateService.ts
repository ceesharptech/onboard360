import prisma from '../utils/prisma';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { CreateTemplateInput, UpdateTemplateInput, TemplateTaskInput } from '../utils/validation';
import logger from '../utils/logger';

export class TemplateService {
  /**
   * Create an onboarding template with tasks.
   */
  async createTemplate(
    data: CreateTemplateInput,
    user: { userId: string; companyId: string }
  ) {
    if (data.departmentId) {
      const dept = await prisma.department.findFirst({
        where: { id: data.departmentId, companyId: user.companyId },
      });
      if (!dept) {
        throw new NotFoundError('Department not found in company', 'NOT_FOUND');
      }
    }

    // If isDefault is true and departmentId is set, optionally ensure single default or keep boolean
    const template = await prisma.$transaction(async (tx) => {
      const created = await tx.onboardingTemplate.create({
        data: {
          companyId: user.companyId,
          departmentId: data.departmentId ?? null,
          jobRole: data.jobRole ?? null,
          name: data.name,
          isDefault: data.isDefault ?? false,
          createdBy: user.userId,
          tasks: {
            create: (data.tasks || []).map((task, idx) => ({
              title: task.title,
              description: task.description ?? null,
              category: task.category,
              orderIndex: task.orderIndex ?? idx,
              assigneeType: task.assigneeType,
              dueOffsetDays: task.dueOffsetDays,
            })),
          },
        },
        include: {
          tasks: {
            orderBy: { orderIndex: 'asc' },
          },
          department: {
            select: { id: true, name: true },
          },
        },
      });

      return created;
    });

    logger.info({ templateId: template.id, name: template.name }, 'Created onboarding template');
    return template;
  }

  /**
   * List templates in company, optionally filtered by department.
   */
  async listTemplates(companyId: string, departmentId?: string | null) {
    const whereClause: { companyId: string; departmentId?: string } = { companyId };
    if (departmentId) {
      whereClause.departmentId = departmentId;
    }

    return prisma.onboardingTemplate.findMany({
      where: whereClause,
      include: {
        department: {
          select: { id: true, name: true },
        },
        tasks: {
          orderBy: { orderIndex: 'asc' },
        },
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Get template by ID, verifying company scope.
   */
  async getTemplateById(id: string, companyId: string) {
    const template = await prisma.onboardingTemplate.findFirst({
      where: { id, companyId },
      include: {
        department: {
          select: { id: true, name: true },
        },
        tasks: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!template) {
      throw new NotFoundError('Template not found', 'NOT_FOUND');
    }

    return template;
  }

  /**
   * Update template and its tasks.
   */
  async updateTemplate(
    id: string,
    data: UpdateTemplateInput,
    companyId: string
  ) {
    const existing = await prisma.onboardingTemplate.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundError('Template not found', 'NOT_FOUND');
    }

    const updated = await prisma.$transaction(async (tx) => {
      // If tasks array is provided, replace tasks
      if (data.tasks !== undefined) {
        // Delete existing tasks
        await tx.onboardingTemplateTask.deleteMany({
          where: { templateId: id },
        });

        // Insert new tasks
        if (data.tasks.length > 0) {
          await tx.onboardingTemplateTask.createMany({
            data: data.tasks.map((task, idx) => ({
              templateId: id,
              title: task.title,
              description: task.description ?? null,
              category: task.category,
              orderIndex: task.orderIndex ?? idx,
              assigneeType: task.assigneeType,
              dueOffsetDays: task.dueOffsetDays,
            })),
          });
        }
      }

      return tx.onboardingTemplate.update({
        where: { id },
        data: {
          name: data.name ?? undefined,
          departmentId: data.departmentId !== undefined ? data.departmentId : undefined,
          jobRole: data.jobRole !== undefined ? data.jobRole : undefined,
          isDefault: data.isDefault !== undefined ? data.isDefault : undefined,
        },
        include: {
          department: {
            select: { id: true, name: true },
          },
          tasks: {
            orderBy: { orderIndex: 'asc' },
          },
        },
      });
    });

    logger.info({ templateId: id }, 'Updated onboarding template');
    return updated;
  }

  /**
   * Reorder template tasks.
   */
  async reorderTasks(templateId: string, taskIds: string[], companyId: string) {
    const template = await prisma.onboardingTemplate.findFirst({
      where: { id: templateId, companyId },
      include: { tasks: true },
    });

    if (!template) {
      throw new NotFoundError('Template not found', 'NOT_FOUND');
    }

    await prisma.$transaction(
      taskIds.map((taskId, index) =>
        prisma.onboardingTemplateTask.updateMany({
          where: { id: taskId, templateId },
          data: { orderIndex: index },
        })
      )
    );

    return this.getTemplateById(templateId, companyId);
  }

  /**
   * Delete template.
   */
  async deleteTemplate(id: string, companyId: string) {
    const existing = await prisma.onboardingTemplate.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      throw new NotFoundError('Template not found', 'NOT_FOUND');
    }

    await prisma.onboardingTemplate.delete({
      where: { id },
    });

    logger.info({ templateId: id }, 'Deleted onboarding template');
    return { success: true };
  }
}

export const templateService = new TemplateService();
export default templateService;
