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

export const passwordComplexity = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const changePasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email address is required'),
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordComplexity,
});

export const createUserSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('A valid email address is required'),
    password: passwordComplexity,
    role: z.enum(['hr_admin', 'manager', 'employee'], {
      errorMap: () => ({ message: "Role must be 'hr_admin', 'manager', or 'employee'" }),
    }),
    departmentId: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.role !== 'hr_admin' && (!data.departmentId || data.departmentId.trim() === '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'departmentId is required for managers and employees',
        path: ['departmentId'],
      });
    }
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
  taskUrl: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  relatedDocumentId: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
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

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(1, 'Department name is required').max(100, 'Department name must not exceed 100 characters'),
});

export const updateDepartmentSchema = z.object({
  name: z.string().trim().min(1, 'Department name is required').max(100, 'Department name must not exceed 100 characters'),
});

export const reorderTemplateTasksSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1, 'At least one taskId is required'),
});

export const createEmployeeSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required'),
    email: z.string().trim().toLowerCase().email('A valid email address is required'),
    role: z.enum(['employee', 'manager', 'hr_admin']).default('employee'),
    initialPassword: passwordComplexity.optional(),
    departmentId: z.string().uuid('departmentId must be a valid UUID').optional().nullable(),
    jobRole: z.string().trim().optional().nullable(),
    startDate: z.string().optional().nullable(),
    managerId: z.string().uuid().optional().nullable(),
    employmentType: z
      .enum(['full_time', 'part_time', 'contract'], {
        errorMap: () => ({
          message: "employmentType must be 'full_time', 'part_time', or 'contract'",
        }),
      })
      .optional()
      .nullable(),
    mentorId: z.string().uuid().optional().nullable(),
    templateId: z.string().uuid().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.role !== 'hr_admin') {
      if (!data.departmentId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Department is required for managers and employees',
          path: ['departmentId'],
        });
      }
      if (!data.jobRole || data.jobRole.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Job role is required for managers and employees',
          path: ['jobRole'],
        });
      }
      if (!data.startDate || data.startDate.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Start date is required for managers and employees',
          path: ['startDate'],
        });
      }
      if (!data.employmentType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Employment type is required for managers and employees',
          path: ['employmentType'],
        });
      }
    }
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
  limit: z.coerce
    .number()
    .int()
    .positive()
    .default(20)
    .transform((val) => Math.min(val, 100)),
  search: z.string().trim().optional(),
  departmentId: z.string().uuid().optional(),
});

export const userListQuerySchema = paginationQuerySchema.extend({
  paginate: z
    .preprocess((val) => {
      if (val === 'false' || val === false) return false;
      if (val === 'true' || val === true) return true;
      return undefined;
    }, z.boolean().optional()),
});

export const employeeListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['not_started', 'in_progress', 'complete', 'overdue']).optional(),
});

export const createAdHocTaskSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required').max(200),
  description: z.string().trim().optional().nullable(),
  category: z.string().trim().min(1).max(100).default('General'),
  assigneeType: z
    .enum(['employee', 'manager', 'mentor'], {
      errorMap: () => ({ message: "assigneeType must be 'employee', 'manager', or 'mentor'" }),
    })
    .default('employee'),
  dueDate: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null))
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'dueDate must be a valid date',
    }),
  taskUrl: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null))
    .refine((val) => !val || z.string().url().safeParse(val).success, {
      message: 'taskUrl must be a valid URL',
    }),
  relatedDocumentId: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
});

// --- Phase 5.5 Schemas: Training & Guides ---

export function extractYouTubeVideoId(rawUrl: string): { success: true; videoId: string } | { success: false; error: string } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { success: false, error: 'YouTube URL is required' };
  }

  const trimmed = rawUrl.trim();
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return { success: false, error: 'Invalid URL format' };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const validDomains = [
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'youtu.be',
  ];

  const isYouTubeDomain = validDomains.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  );

  if (!isYouTubeDomain) {
    return {
      success: false,
      error: 'URL must be a genuine YouTube link (youtube.com or youtu.be)',
    };
  }

  let videoId: string | null = null;

  if (hostname === 'youtu.be') {
    const pathname = parsedUrl.pathname.slice(1);
    videoId = pathname.split('/')[0] || null;
  } else {
    if (parsedUrl.pathname === '/watch') {
      videoId = parsedUrl.searchParams.get('v');
    } else if (parsedUrl.pathname.startsWith('/embed/')) {
      videoId = parsedUrl.pathname.split('/')[2] || null;
    } else if (parsedUrl.pathname.startsWith('/v/')) {
      videoId = parsedUrl.pathname.split('/')[2] || null;
    } else if (parsedUrl.pathname.startsWith('/shorts/')) {
      videoId = parsedUrl.pathname.split('/')[2] || null;
    }
  }

  const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;
  if (!videoId || !YOUTUBE_ID_REGEX.test(videoId)) {
    return {
      success: false,
      error: 'YouTube URL does not contain a valid 11-character video ID',
    };
  }

  return { success: true, videoId };
}

export const createTrainingEntrySchema = z
  .preprocess((val: any) => {
    if (val && typeof val === 'object') {
      const copy = { ...val };
      if (!copy.contentType && copy.type) {
        copy.contentType = copy.type;
      }
      return copy;
    }
    return val;
  }, z.object({
    title: z.string().trim().min(1, 'Title is required').max(200, 'Title must be 200 characters or fewer'),
    description: z.string().trim().min(1, 'Description is required').max(1000, 'Description must be 1000 characters or fewer'),
    contentType: z.enum(['video', 'guide'], {
      errorMap: () => ({ message: "contentType must be either 'video' or 'guide'" }),
    }),
    youtubeUrl: z.string().trim().optional().nullable(),
    guideContent: z.string().trim().optional().nullable(),
  }))
  .superRefine((data, ctx) => {
    if (data.contentType === 'video') {
      if (!data.youtubeUrl || data.youtubeUrl.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'youtubeUrl is required for video training entries',
          path: ['youtubeUrl'],
        });
      } else {
        const extraction = extractYouTubeVideoId(data.youtubeUrl);
        if (!extraction.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: extraction.error,
            path: ['youtubeUrl'],
          });
        }
      }
    } else if (data.contentType === 'guide') {
      if (!data.guideContent || data.guideContent.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'guideContent is required for guide training entries',
          path: ['guideContent'],
        });
      }
    }
  });

export const updateTrainingEntrySchema = z
  .preprocess((val: any) => {
    if (val && typeof val === 'object') {
      const copy = { ...val };
      if (!copy.contentType && copy.type) {
        copy.contentType = copy.type;
      }
      return copy;
    }
    return val;
  }, z.object({
    title: z.string().trim().min(1, 'Title is required').max(200).optional(),
    description: z.string().trim().min(1, 'Description is required').max(1000).optional(),
    contentType: z.enum(['video', 'guide']).optional(),
    youtubeUrl: z.string().trim().optional().nullable(),
    guideContent: z.string().trim().optional().nullable(),
  }))
  .superRefine((data, ctx) => {
    if (data.contentType === 'video' && data.youtubeUrl) {
      const extraction = extractYouTubeVideoId(data.youtubeUrl);
      if (!extraction.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: extraction.error,
          path: ['youtubeUrl'],
        });
      }
    } else if (data.contentType === 'guide' && data.guideContent !== undefined) {
      if (!data.guideContent || data.guideContent.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'guideContent cannot be empty',
          path: ['guideContent'],
        });
      }
    }
  });

export const trainingListQuerySchema = z.preprocess(
  (val: any) => {
    if (val && typeof val === 'object') {
      const copy = { ...val };
      if (!copy.contentType && copy.type) {
        copy.contentType = copy.type;
      }
      return copy;
    }
    return val;
  },
  z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().trim().optional(),
    contentType: z.enum(['video', 'guide']).optional(),
  })
);

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type AddMentorInput = z.infer<typeof addMentorSchema>;
export type TemplateTaskInput = z.infer<typeof templateTaskSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type ReorderTemplateTasksInput = z.infer<typeof reorderTemplateTasksSchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type UpdateEmployeeTaskInput = z.infer<typeof updateEmployeeTaskSchema>;
export type CreateAdHocTaskInput = z.infer<typeof createAdHocTaskSchema>;
export type PaginationQueryInput = z.infer<typeof paginationQuerySchema>;
export type UserListQueryInput = z.infer<typeof userListQuerySchema>;
export type EmployeeListQueryInput = z.infer<typeof employeeListQuerySchema>;
export type CreateTrainingEntryInput = z.infer<typeof createTrainingEntrySchema>;
export type UpdateTrainingEntryInput = z.infer<typeof updateTrainingEntrySchema>;
export type TrainingListQueryInput = z.infer<typeof trainingListQuerySchema>;

// --- Phase 5.7 Schemas (Platform Administration & Tenant Onboarding) ---

export const platformAdminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email address is required'),
  password: z.string().min(1, 'Password is required'),
});

export const createCompanySchema = z.object({
  companyName: z.string().trim().min(1, 'Company name is required'),
  hrAdminEmail: z.string().trim().toLowerCase().email('A valid email address is required for HR Admin'),
  hrAdminPassword: passwordComplexity.optional(),
});

export const companyListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
});

export type PlatformAdminLoginInput = z.infer<typeof platformAdminLoginSchema>;
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type CompanyListQueryInput = z.infer<typeof companyListQuerySchema>;
