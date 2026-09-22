const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const PLATFORM_ADMIN_TOKEN_KEY = 'platform_admin_access_token';

export interface PlatformAdmin {
  id: string;
  email: string;
}

export interface CompanySummary {
  id: string;
  name: string;
  createdAt: string;
  employeeCount: number;
  departmentCount: number;
  userCount: number;
  hrAdmin: {
    id: string;
    email: string;
  } | null;
  _count?: {
    employees: number;
    departments: number;
    users?: number;
  };
}

export interface CompanyDetail {
  id: string;
  name: string;
  createdAt: string;
  employeeCount: number;
  departmentCount: number;
  userCount: number;
  templateCount: number;
  documentCount: number;
  libraryDocumentCount: number;
  trainingEntryCount: number;
  hrAdmin: {
    id: string;
    email: string;
    mustChangePassword?: boolean;
  } | null;
  company?: {
    id: string;
    name: string;
    createdAt: string;
  };
  stats?: {
    totalEmployees: number;
    totalDepartments: number;
    totalUsers: number;
    totalTemplates: number;
    totalDocuments: number;
    totalLibraryDocuments: number;
    totalTrainingEntries: number;
    completionRate: number;
  };
}

export interface CompanyListResponse {
  status: string;
  data: CompanySummary[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface OnboardCompanyData {
  companyName: string;
  hrAdminEmail: string;
  hrAdminPassword?: string;
}

export interface OnboardCompanyResponse {
  status: string;
  data: {
    company: {
      id: string;
      name: string;
      createdAt: string;
    };
    hrAdmin: {
      id: string;
      email: string;
      mustChangePassword: boolean;
    };
  };
}

async function platformAdminFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = localStorage.getItem(PLATFORM_ADMIN_TOKEN_KEY);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg =
      body?.error?.message ||
      body?.message ||
      `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return body as T;
}

export const platformAdminApi = {
  getToken(): string | null {
    return localStorage.getItem(PLATFORM_ADMIN_TOKEN_KEY);
  },

  setToken(token: string) {
    localStorage.setItem(PLATFORM_ADMIN_TOKEN_KEY, token);
  },

  clearToken() {
    localStorage.removeItem(PLATFORM_ADMIN_TOKEN_KEY);
  },

  async login(email: string, password: string): Promise<{ token: string; admin: PlatformAdmin }> {
    const res = await platformAdminFetch<{
      status: string;
      data: { token: string; admin: PlatformAdmin };
      token?: string;
      admin?: PlatformAdmin;
    }>('/platform-admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    const token = res.data?.token || res.token;
    const admin = res.data?.admin || res.admin;

    if (!token || !admin) {
      throw new Error('Invalid response structure from server');
    }

    this.setToken(token);
    return { token, admin };
  },

  async getMe(): Promise<PlatformAdmin> {
    const res = await platformAdminFetch<{ status: string; data: PlatformAdmin }>(
      '/platform-admin/auth/me'
    );
    return res.data;
  },

  async listCompanies(params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<CompanyListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));

    const qs = searchParams.toString();
    const endpoint = `/platform-admin/companies${qs ? `?${qs}` : ''}`;
    return platformAdminFetch<CompanyListResponse>(endpoint);
  },

  async getCompany(id: string): Promise<CompanyDetail> {
    const res = await platformAdminFetch<{ status: string; data: CompanyDetail }>(
      `/platform-admin/companies/${id}`
    );
    return res.data;
  },

  async createCompany(data: OnboardCompanyData): Promise<OnboardCompanyResponse['data']> {
    const res = await platformAdminFetch<OnboardCompanyResponse>(
      '/platform-admin/companies',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    return res.data;
  },
};
