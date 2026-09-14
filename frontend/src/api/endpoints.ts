import { apiRequest } from './client';

export interface User {
  id: string;
  email: string;
  role: 'hr_admin' | 'manager' | 'employee';
  companyId: string;
  departmentId: string | null;
  mustChangePassword?: boolean;
}

export interface Department {
  id: string;
  name: string;
  companyId: string;
  _count?: {
    employees: number;
    mentors: number;
  };
}

export interface MentorMentee {
  id: string;
  name: string;
  jobRole: string;
  startDate: string;
  department: { id: string; name: string };
  progress: {
    totalTasks: number;
    completedTasks: number;
    percentComplete: number;
  };
}

export interface Mentor {
  id: string;
  companyId: string;
  departmentId: string;
  userId: string;
  isActive: boolean;
  currentMenteeCount: number;
  user: {
    id: string;
    email: string;
    role: string;
  };
  mentees?: MentorMentee[];
}

export interface TemplateTask {
  id?: string;
  title: string;
  description?: string | null;
  category: string;
  orderIndex: number;
  assigneeType: 'employee' | 'manager' | 'mentor';
  dueOffsetDays: number;
  taskUrl?: string | null;
}

export interface OnboardingTemplate {
  id: string;
  companyId: string;
  departmentId: string | null;
  jobRole: string | null;
  name: string;
  isDefault: boolean;
  createdBy: string;
  tasks: TemplateTask[];
  department?: { id: string; name: string } | null;
  _count?: { tasks: number };
}

export interface EmployeeTask {
  id: string;
  employeeId: string;
  title: string;
  description: string | null;
  category: string;
  orderIndex: number;
  assigneeType: 'employee' | 'manager' | 'mentor';
  dueDate: string | null;
  taskUrl?: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  completedAt: string | null;
  sourceTemplateTaskId: string | null;
}

export interface ManagerAssignedTask extends EmployeeTask {
  employee: {
    id: string;
    name: string;
    jobRole: string;
    email: string;
    department: { id: string; name: string };
  };
}

export interface MyMenteeItem {
  id: string;
  name: string;
  email: string;
  jobRole: string;
  startDate: string;
  department: { id: string; name: string };
  progress: EmployeeProgress;
  mentorTasks: EmployeeTask[];
  tasks?: EmployeeTask[];
}

export interface MyMenteeResponse {
  isMentor: boolean;
  mentees: MyMenteeItem[];
}

export interface EmployeeProgress {
  totalTasks: number;
  completedTasks: number;
  percentComplete: number;
  overdueTasks: number;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  jobRole: string;
  startDate: string;
  employmentType: 'full_time' | 'part_time' | 'contract';
  departmentId: string;
  department: { id: string; name: string };
  userId: string | null;
  managerId: string | null;
  mentorId: string | null;
  mentor: { id: string; email: string } | null;
  tasks?: EmployeeTask[];
  progress?: EmployeeProgress;
  createdAt?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface LoginResult {
  accessToken?: string;
  refreshToken?: string;
  user?: User;
  mustChangePassword?: boolean;
  email?: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<LoginResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    }),
  changePassword: (email: string, currentPassword: string, newPassword: string) =>
    apiRequest<{ accessToken: string; refreshToken: string; user: User }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ email, currentPassword, newPassword }),
      skipAuth: true,
    }),
  logout: (refreshToken: string) =>
    apiRequest('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),
};

export const userApi = {
  list: (departmentId?: string) => {
    const query = departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : '';
    return apiRequest<User[]>(`/users${query}`);
  },
};

export const departmentApi = {
  list: () => apiRequest<Department[]>('/departments'),
  getMentors: (departmentId: string) => apiRequest<Mentor[]>(`/departments/${departmentId}/mentors`),
  addMentor: (departmentId: string, userId: string) =>
    apiRequest<Mentor>(`/departments/${departmentId}/mentors`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
  removeMentor: (departmentId: string, mentorId: string) =>
    apiRequest(`/departments/${departmentId}/mentors/${mentorId}`, {
      method: 'DELETE',
    }),
};

export const templateApi = {
  list: (departmentId?: string) => {
    const query = departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : '';
    return apiRequest<OnboardingTemplate[]>(`/templates${query}`);
  },
  getOne: (id: string) => apiRequest<OnboardingTemplate>(`/templates/${id}`),
  create: (data: Partial<OnboardingTemplate>) =>
    apiRequest<OnboardingTemplate>('/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<OnboardingTemplate>) =>
    apiRequest<OnboardingTemplate>(`/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  reorder: (id: string, taskIds: string[]) =>
    apiRequest<OnboardingTemplate>(`/templates/${id}/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ taskIds }),
    }),
  delete: (id: string) =>
    apiRequest(`/templates/${id}`, {
      method: 'DELETE',
    }),
};

export const employeeApi = {
  list: (params: { departmentId?: string; page?: number; limit?: number; search?: string } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.departmentId) searchParams.set('departmentId', params.departmentId);
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.search) searchParams.set('search', params.search);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiRequest<Employee[]>(`/employees${query}`);
  },
  getOne: (id: string) => apiRequest<Employee>(`/employees/${id}`),
  create: (data: {
    name: string;
    email: string;
    role?: 'hr_admin' | 'manager' | 'employee';
    initialPassword?: string;
    departmentId?: string | null;
    jobRole?: string | null;
    startDate?: string | null;
    employmentType?: 'full_time' | 'part_time' | 'contract' | null;
    managerId?: string | null;
    mentorId?: string | null;
  }) =>
    apiRequest<Employee>('/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Employee>) =>
    apiRequest<Employee>(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  updateTask: (
    employeeId: string,
    taskId: string,
    data: { status?: 'pending' | 'in_progress' | 'completed'; assigneeType?: 'employee' | 'manager' | 'mentor' }
  ) =>
    apiRequest<EmployeeTask>(`/employees/${employeeId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  getProgress: (employeeId: string) =>
    apiRequest<EmployeeProgress>(`/employees/${employeeId}/progress`),
  getMyManagerTasks: () =>
    apiRequest<ManagerAssignedTask[]>('/employees/manager/assigned-tasks'),
  getMyMentees: () =>
    apiRequest<MyMenteeResponse>('/employees/mentor/my-mentees'),
};

export interface DocumentItem {
  id: string;
  companyId: string;
  uploadedBy: string;
  filename: string;
  storagePath: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  chunkCount?: number;
}

export interface RetrievedChunkItem {
  id: string;
  documentId: string;
  companyId: string;
  content: string;
  chunkIndex: number;
  similarity: number;
  documentFilename: string;
}

export const documentApi = {
  list: () => apiRequest<{ documents: DocumentItem[] }>('/documents'),
  getOne: (id: string) => apiRequest<{ document: DocumentItem }>(`/documents/${id}`),
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest<{ document: DocumentItem }>('/documents', {
      method: 'POST',
      body: formData,
    });
  },
  replace: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest<{ document: DocumentItem }>(`/documents/${id}`, {
      method: 'PUT',
      body: formData,
    });
  },
  delete: (id: string) =>
    apiRequest<{ message: string }>(`/documents/${id}`, {
      method: 'DELETE',
    }),
  retrieve: (query: string, topK = 5) =>
    apiRequest<{ query: string; totalMatches: number; chunks: RetrievedChunkItem[] }>(
      '/documents/retrieve',
      {
        method: 'POST',
        body: JSON.stringify({ query, topK }),
      }
    ),
};

export interface AssistantChatResponse {
  answer: string;
  sources: string[];
  isFallback: boolean;
}

export const assistantApi = {
  chat: (question: string) =>
    apiRequest<AssistantChatResponse>('/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),
};

