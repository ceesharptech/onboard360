import { apiRequest } from './client';

export interface User {
  id: string;
  email: string;
  role: 'hr_admin' | 'manager' | 'employee';
  companyId: string;
  departmentId: string | null;
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
}

export interface TemplateTask {
  id?: string;
  title: string;
  description?: string | null;
  category: string;
  orderIndex: number;
  assigneeType: 'employee' | 'manager' | 'mentor';
  dueOffsetDays: number;
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
  status: 'pending' | 'in_progress' | 'completed';
  completedAt: string | null;
  sourceTemplateTaskId: string | null;
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

export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<{ accessToken: string; refreshToken: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    }),
  logout: (refreshToken: string) =>
    apiRequest('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),
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
    departmentId: string;
    jobRole: string;
    startDate: string;
    employmentType: 'full_time' | 'part_time' | 'contract';
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
};
