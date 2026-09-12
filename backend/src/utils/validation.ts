import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email address is required'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email address is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  role: z.enum(['manager', 'employee'], {
    errorMap: () => ({ message: "Role must be either 'manager' or 'employee'" }),
  }),
  departmentId: z.string().min(1, 'departmentId is required for managers and employees'),
});

// --- Phase 2 Schemas ---

export const addMentorSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
});

export const templateTaskSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, 'Task title is required'),
  description: z.string().optional().nullable(),
  category: z.string().trim().min(1, 'Task category is required'),
  orderIndex: z.number().int().nonnegative('orderIndex must be non-negative'),
  assigneeType: z.enum(['employee', 'manager', 'mentor'], {
    errorMap: () => ({ message: "assigneeType must be 'employee', 'manager', or 'mentor'" }),
  }),
  dueOffsetDays: z.number().int().nonnegative('dueOffsetDays must be non-negative'),
});

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Template name is required'),
  departmentId: z.string().uuid('departmentId must be a valid UUID').optional().nullable(),
  jobRole: z.string().trim().optional().nullable(),
  isDefault: z.boolean().optional().default(false),
  tasks: z.array(templateTaskSchema).optional().default([]),
});

export const updateTemplateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  departmentId: z.string().uuid('departmentId must be a valid UUID').optional().nullable(),
  jobRole: z.string().trim().optional().nullable(),
  isDefault: z.boolean().optional(),
  tasks: z.array(templateTaskSchema).optional(),
});

export const reorderTemplateTasksSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1, 'At least one taskId is required'),
});

export const createEmployeeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().toLowerCase().email('A valid email address is required'),
  departmentId: z.string().uuid('departmentId must be a valid UUID'),
  jobRole: z.string().trim().min(1, 'Job role is required'),
  startDate: z.string().min(1, 'startDate is required'),
  managerId: z.string().uuid().optional().nullable(),
  employmentType: z.enum(['full_time', 'part_time', 'contract'], {
    errorMap: () => ({ message: "employmentType must be 'full_time', 'part_time', or 'contract'" }),
  }),
  mentorId: z.string().uuid().optional().nullable(),
});

export const updateEmployeeSchema = z.object({
  name: z.string().trim().min(1).optional(),
  jobRole: z.string().trim().min(1).optional(),
  departmentId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional().nullable(),
  mentorId: z.string().uuid().optional().nullable(),
  employmentType: z.enum(['full_time', 'part_time', 'contract']).optional(),
});

export const updateEmployeeTaskSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
  assigneeType: z.enum(['employee', 'manager', 'mentor']).optional(),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  departmentId: z.string().uuid().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type AddMentorInput = z.infer<typeof addMentorSchema>;
export type TemplateTaskInput = z.infer<typeof templateTaskSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type ReorderTemplateTasksInput = z.infer<typeof reorderTemplateTasksSchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type UpdateEmployeeTaskInput = z.infer<typeof updateEmployeeTaskSchema>;
export type PaginationQueryInput = z.infer<typeof paginationQuerySchema>;
