import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, UserRole, UserTokenPayload } from '../utils/token';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '../utils/errors';

/**
 * Express Request augmentation to carry authenticated user context.
 */
declare global {
  namespace Express {
    interface Request {
      user?: UserTokenPayload;
    }
  }
}

/**
 * Global authentication middleware.
 * Verifies Bearer JWT access token from Authorization header.
 * Attaches { userId, role, companyId, departmentId } to req.user.
 * Rejects with 401 Unauthorized if missing, malformed, or expired.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed authorization header', 'MISSING_TOKEN');
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    throw new UnauthorizedError('Token is required', 'MISSING_TOKEN');
  }

  const decoded = verifyAccessToken(token);
  req.user = {
    userId: decoded.userId,
    role: decoded.role,
    companyId: decoded.companyId,
    departmentId: decoded.departmentId ?? null,
  };

  next();
}

/**
 * Role-based authorization middleware.
 * Rejects with 403 Forbidden if user's role is not within allowed roles.
 * @param allowedRoles List of roles permitted to access the route
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required', 'UNAUTHORIZED');
    }

    if (!allowedRoles.includes(req.user.role)) {
      // If a file was buffered/uploaded during multipart parsing, clean it up immediately
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          // Ignore unlink error
        }
      }
      throw new ForbiddenError(
        `User role '${req.user.role}' is not authorized to access this resource`,
        'FORBIDDEN'
      );
    }

    next();
  };
}

/**
 * Scope to Company helper.
 * Enforces that every query touching tenant resources filters strictly by req.user.companyId.
 * Per architecture.md Section 3: Never query without company_id scoping.
 *
 * Consistent 404 behavior: if a target resource's companyId does not match the requester's companyId,
 * return a 404 NotFound to prevent cross-tenant existence enumeration.
 */
export function assertCompanyScope(targetCompanyId: string, userCompanyId: string): void {
  if (targetCompanyId !== userCompanyId) {
    throw new NotFoundError('Resource not found', 'NOT_FOUND');
  }
}

/**
 * Helper to produce a Prisma where clause scoped to the authenticated user's company.
 * Feature code in all phases should use this to construct queries safely.
 */
export function scopeToCompany<T extends Record<string, unknown>>(
  req: Request,
  additionalWhere?: T
): T & { companyId: string } {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required', 'UNAUTHORIZED');
  }
  return {
    ...(additionalWhere as T),
    companyId: req.user.companyId,
  };
}

/**
 * Scope to Department helper.
 * For manager-restricted actions, verifies the target resource's departmentId matches
 * the manager's departmentId.
 *
 * Rules:
 * - hr_admin: full access within their company; department check is bypassed.
 * - manager: must match their own departmentId. If mismatch, throws 404 NotFound
 *   (per security.md Section 9, returning 404 prevents cross-department enumeration).
 * - employee: not permitted for department-level management actions (throws 403 Forbidden).
 */
export function scopeToDepartment(targetDepartmentId: string | null | undefined, req: Request): void {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required', 'UNAUTHORIZED');
  }

  // HR Admin bypasses department restriction within company
  if (req.user.role === 'hr_admin') {
    return;
  }

  if (req.user.role === 'manager') {
    if (!req.user.departmentId || req.user.departmentId !== targetDepartmentId) {
      // Return 404 to avoid leaking existence of resources in other departments
      throw new NotFoundError('Resource not found', 'NOT_FOUND');
    }
    return;
  }

  // Employees cannot perform department-scoped management actions
  throw new ForbiddenError('Employees cannot access department management actions', 'FORBIDDEN');
}

/**
 * Scope to Own Employee helper.
 * For employee-restricted actions, verifies that the target resource belongs to the
 * authenticated user's own employee record.
 *
 * Rules:
 * - hr_admin: can access any employee in their company.
 * - manager: can access employees within their own department.
 * - employee: can access ONLY their own record. If mismatch, throws 404 NotFound.
 */
export function scopeToOwnEmployee(
  targetEmployee: { id: string; userId?: string | null; departmentId: string; companyId: string },
  req: Request
): void {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required', 'UNAUTHORIZED');
  }

  // Cross-company check first
  assertCompanyScope(targetEmployee.companyId, req.user.companyId);

  if (req.user.role === 'hr_admin') {
    return;
  }

  if (req.user.role === 'manager') {
    if (req.user.departmentId !== targetEmployee.departmentId) {
      throw new NotFoundError('Resource not found', 'NOT_FOUND');
    }
    return;
  }

  if (req.user.role === 'employee') {
    if (targetEmployee.userId !== req.user.userId) {
      // 404 so employees cannot discover other employees' IDs
      throw new NotFoundError('Resource not found', 'NOT_FOUND');
    }
    return;
  }

  throw new ForbiddenError('Access denied', 'FORBIDDEN');
}
