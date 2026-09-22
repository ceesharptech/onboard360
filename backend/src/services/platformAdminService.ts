import crypto from 'crypto';
import prisma from '../utils/prisma';
import { comparePassword } from '../utils/password';
import { signPlatformAdminToken } from '../utils/platformAdminToken';
import { UnauthorizedError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import { userService } from './userService';
import { CreateCompanyInput, CompanyListQueryInput } from '../utils/validation';

export interface FormattedCompanyListItem {
  id: string;
  name: string;
  createdAt: Date;
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
    users: number;
  };
}

export interface FormattedCompanyDetail extends FormattedCompanyListItem {
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
    createdAt: Date;
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

export class PlatformAdminService {
  /**
   * Authenticates a platform administrator via the isolated platform_admins table.
   */
  async login(email: string, password: string) {
    const admin = await prisma.platformAdmin.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!admin) {
      throw new UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const isValid = await comparePassword(password, admin.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS');
    }

    const accessToken = signPlatformAdminToken({
      adminId: admin.id,
      email: admin.email,
    });

    logger.info({ adminId: admin.id, email: admin.email }, 'Platform admin logged in successfully');

    return {
      accessToken,
      admin: {
        id: admin.id,
        email: admin.email,
      },
    };
  }

  /**
   * Creates a new company and its initial HR Admin atomically within a single transaction.
   */
  async createCompany(input: CreateCompanyInput) {
    const companyName = input.companyName.trim();
    const hrAdminEmail = input.hrAdminEmail.toLowerCase().trim();

    // Generate compliant initial password if none was specified
    const initialPassword =
      input.hrAdminPassword ||
      `Onboard${crypto.randomBytes(4).toString('hex')}A1!`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the company
      const company = await tx.company.create({
        data: {
          name: companyName,
        },
      });

      // 2. Provision the initial HR Admin account (reusing userService logic)
      const hrAdmin = await userService.createInitialHrAdmin(
        company.id,
        {
          email: hrAdminEmail,
          password: initialPassword,
        },
        tx
      );

      return {
        company,
        hrAdmin,
      };
    });

    logger.info(
      { companyId: result.company.id, companyName: result.company.name, hrAdminId: result.hrAdmin.id },
      'Company and initial HR Admin onboarded atomically by Platform Admin'
    );

    return {
      company: {
        id: result.company.id,
        name: result.company.name,
        createdAt: result.company.createdAt,
      },
      hrAdmin: {
        id: result.hrAdmin.id,
        email: result.hrAdmin.email,
        mustChangePassword: result.hrAdmin.mustChangePassword,
      },
      initialPassword: input.hrAdminPassword ? undefined : initialPassword,
    };
  }

  /**
   * Lists all registered companies across the platform with pagination and at-a-glance stats.
   */
  async listCompanies(query: CompanyListQueryInput) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search && query.search.trim()) {
      where.name = {
        contains: query.search.trim(),
        mode: 'insensitive',
      };
    }

    const [total, companies] = await Promise.all([
      prisma.company.count({ where }),
      prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              employees: true,
              departments: true,
              users: true,
            },
          },
          users: {
            where: { role: 'hr_admin' },
            select: {
              id: true,
              email: true,
            },
            take: 1,
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    const formatted: FormattedCompanyListItem[] = companies.map((c) => ({
      id: c.id,
      name: c.name,
      createdAt: c.createdAt,
      employeeCount: c._count.employees,
      departmentCount: c._count.departments,
      userCount: c._count.users,
      hrAdmin: c.users[0] ? { id: c.users[0].id, email: c.users[0].email } : null,
      _count: {
        employees: c._count.employees,
        departments: c._count.departments,
        users: c._count.users,
      },
    }));

    return {
      data: formatted,
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
   * Retrieves single company details and platform stats.
   */
  async getCompany(id: string): Promise<FormattedCompanyDetail> {
    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            employees: true,
            departments: true,
            users: true,
            onboardingTemplates: true,
            documents: true,
            libraryDocuments: true,
            trainingEntries: true,
          },
        },
        users: {
          where: { role: 'hr_admin' },
          select: {
            id: true,
            email: true,
            mustChangePassword: true,
          },
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!company) {
      throw new NotFoundError('Company not found', 'COMPANY_NOT_FOUND');
    }

    const totalEmployees = company._count.employees;
    const totalDepartments = company._count.departments;
    const totalUsers = company._count.users;
    const totalTemplates = company._count.onboardingTemplates;

    return {
      id: company.id,
      name: company.name,
      createdAt: company.createdAt,
      employeeCount: totalEmployees,
      departmentCount: totalDepartments,
      userCount: totalUsers,
      templateCount: totalTemplates,
      documentCount: company._count.documents,
      libraryDocumentCount: company._count.libraryDocuments,
      trainingEntryCount: company._count.trainingEntries,
      hrAdmin: company.users[0]
        ? {
            id: company.users[0].id,
            email: company.users[0].email,
            mustChangePassword: company.users[0].mustChangePassword,
          }
        : null,
      _count: company._count,
      company: {
        id: company.id,
        name: company.name,
        createdAt: company.createdAt,
      },
      stats: {
        totalEmployees,
        totalDepartments,
        totalUsers,
        totalTemplates,
        totalDocuments: company._count.documents,
        totalLibraryDocuments: company._count.libraryDocuments,
        totalTrainingEntries: company._count.trainingEntries,
        completionRate: 0,
      },
    };
  }
}

export const platformAdminService = new PlatformAdminService();
export default platformAdminService;
