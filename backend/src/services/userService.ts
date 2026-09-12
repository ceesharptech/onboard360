import prisma from '../utils/prisma';
import { hashPassword } from '../utils/password';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors';
import { CreateUserInput } from '../utils/validation';
import { UserTokenPayload } from '../utils/token';
import { logger } from '../utils/logger';

export interface SanitizedUser {
  id: string;
  email: string;
  role: string;
  companyId: string;
  departmentId: string | null;
  createdAt: Date;
}

export class UserService {
  /**
   * Creates a new user account (Manager or Employee) within the HR Admin's company.
   * Scoped strictly to the HR Admin's companyId per architecture.md Section 3 & security.md Section 2.
   */
  async createUser(adminUser: UserTokenPayload, input: CreateUserInput): Promise<SanitizedUser> {
    const { email, password, role, departmentId } = input;

    // Verify that the specified department belongs to the HR Admin's company
    const department = await prisma.department.findFirst({
      where: {
        id: departmentId,
        companyId: adminUser.companyId,
      },
    });

    if (!department) {
      // 404 to avoid leaking existence of departments in other companies
      throw new NotFoundError('Specified department not found within company', 'DEPARTMENT_NOT_FOUND');
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictError('A user with this email address already exists', 'EMAIL_ALREADY_EXISTS');
    }

    // Hash password with bcrypt
    const passwordHash = await hashPassword(password);

    // Create user in the database
    const newUser = await prisma.user.create({
      data: {
        companyId: adminUser.companyId,
        email,
        passwordHash,
        role,
        departmentId,
      },
      select: {
        id: true,
        email: true,
        role: true,
        companyId: true,
        departmentId: true,
        createdAt: true,
      },
    });

    logger.info(
      { createdUserId: newUser.id, role: newUser.role, companyId: newUser.companyId },
      'User account created by HR Admin'
    );

    return newUser;
  }
}

export const userService = new UserService();
export default userService;
