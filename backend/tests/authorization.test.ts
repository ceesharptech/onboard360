import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Request } from 'express';
import app from '../src/app';
import prisma from '../src/utils/prisma';
import { createTestTenantFixture, cleanupTestTenant, TestTenantFixture } from './testUtils';
import { scopeToDepartment, scopeToOwnEmployee, assertCompanyScope } from '../src/middleware/auth';
import { NotFoundError, ForbiddenError } from '../src/utils/errors';

describe('Authorization & Scoping Middleware (Phase 1)', () => {
  let companyA: TestTenantFixture;
  let companyB: TestTenantFixture;
  const suffixA = `compA_${Date.now()}`;
  const suffixB = `compB_${Date.now()}`;

  beforeAll(async () => {
    companyA = await createTestTenantFixture(suffixA);
    companyB = await createTestTenantFixture(suffixB);
  });

  afterAll(async () => {
    await cleanupTestTenant(companyA.company.id);
    await cleanupTestTenant(companyB.company.id);
  });

  describe('Global Route Protection & Unauthenticated Access', () => {
    it('rejects unauthenticated requests to protected route /users with 401 Unauthorized', async () => {
      const res = await request(app).post('/users').send({
        email: 'nobody@test.com',
        password: 'Password123!',
        role: 'employee',
        departmentId: companyA.departmentA.id,
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('Role-Based Access Control (requireRole)', () => {
    it('rejects an Employee attempting to create a user with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${companyA.employee1DeptA.token}`)
        .send({
          email: `new.emp.${suffixA}@test.com`,
          password: 'Password123!',
          role: 'employee',
          departmentId: companyA.departmentA.id,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects a Manager attempting to create a user with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${companyA.managerDeptA.token}`)
        .send({
          email: `new.emp2.${suffixA}@test.com`,
          password: 'Password123!',
          role: 'employee',
          departmentId: companyA.departmentA.id,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows an HR Admin to create a Manager or Employee account within their own company', async () => {
      const res = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${companyA.hrAdmin.token}`)
        .send({
          email: `created.by.hr.${suffixA}@test.com`,
          password: 'Password123!',
          role: 'manager',
          departmentId: companyA.departmentA.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ok');
      expect(res.body.data.user.email).toBe(`created.by.hr.${suffixA.toLowerCase()}@test.com`);
      expect(res.body.data.user.role).toBe('manager');
      expect(res.body.data.user.companyId).toBe(companyA.company.id);
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });
  });

  describe('Cross-Company Isolation (Tenant Scoping)', () => {
    it('prevents an HR Admin from Company A from assigning a department belonging to Company B', async () => {
      // Attempting to create a user in Company A with Company B's departmentId
      const res = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${companyA.hrAdmin.token}`)
        .send({
          email: `cross.tenant.${suffixA}@test.com`,
          password: 'Password123!',
          role: 'employee',
          departmentId: companyB.departmentA.id, // Target department in Company B!
        });

      // Returns 404 per security.md Section 9 (never leak existence of cross-tenant resource)
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('DEPARTMENT_NOT_FOUND');
    });

    it('assertCompanyScope throws 404 when target resource companyId does not match user companyId', () => {
      expect(() => {
        assertCompanyScope(companyB.company.id, companyA.company.id);
      }).toThrow(NotFoundError);
    });
  });

  describe('Department Scoping Helper (scopeToDepartment)', () => {
    it('allows a Manager to access resources within their own department', () => {
      const fakeReq = {
        user: {
          userId: companyA.managerDeptA.id,
          role: 'manager' as const,
          companyId: companyA.company.id,
          departmentId: companyA.departmentA.id,
        },
      } as unknown as Request;

      expect(() => {
        scopeToDepartment(companyA.departmentA.id, fakeReq);
      }).not.toThrow();
    });

    it('rejects a Manager attempting to access resources in a different department with 404 Not Found', () => {
      const fakeReq = {
        user: {
          userId: companyA.managerDeptA.id,
          role: 'manager' as const,
          companyId: companyA.company.id,
          departmentId: companyA.departmentA.id,
        },
      } as unknown as Request;

      // Accessing Department B from Department A manager
      expect(() => {
        scopeToDepartment(companyA.departmentB.id, fakeReq);
      }).toThrow(NotFoundError);
    });

    it('allows an HR Admin to access resources across any department within their own company', () => {
      const fakeReq = {
        user: {
          userId: companyA.hrAdmin.id,
          role: 'hr_admin' as const,
          companyId: companyA.company.id,
          departmentId: null,
        },
      } as unknown as Request;

      // HR Admin accesses Department A and Department B
      expect(() => {
        scopeToDepartment(companyA.departmentA.id, fakeReq);
        scopeToDepartment(companyA.departmentB.id, fakeReq);
      }).not.toThrow();
    });

    it('rejects an Employee attempting to access department-level management actions with 403 Forbidden', () => {
      const fakeReq = {
        user: {
          userId: companyA.employee1DeptA.id,
          role: 'employee' as const,
          companyId: companyA.company.id,
          departmentId: companyA.departmentA.id,
        },
      } as unknown as Request;

      expect(() => {
        scopeToDepartment(companyA.departmentA.id, fakeReq);
      }).toThrow(ForbiddenError);
    });
  });

  describe('Employee Scoping Helper (scopeToOwnEmployee)', () => {
    it('allows an Employee to access their own employee record', () => {
      const fakeReq = {
        user: {
          userId: companyA.employee1DeptA.id,
          role: 'employee' as const,
          companyId: companyA.company.id,
          departmentId: companyA.departmentA.id,
        },
      } as unknown as Request;

      const ownRecord = {
        id: 'emp-rec-1',
        userId: companyA.employee1DeptA.id,
        departmentId: companyA.departmentA.id,
        companyId: companyA.company.id,
      };

      expect(() => {
        scopeToOwnEmployee(ownRecord, fakeReq);
      }).not.toThrow();
    });

    it('rejects an Employee attempting to access another employee record with 404 Not Found', () => {
      const fakeReq = {
        user: {
          userId: companyA.employee1DeptA.id,
          role: 'employee' as const,
          companyId: companyA.company.id,
          departmentId: companyA.departmentA.id,
        },
      } as unknown as Request;

      const otherEmployeeRecord = {
        id: 'emp-rec-2',
        userId: companyA.employee2DeptA.id, // Different employee!
        departmentId: companyA.departmentA.id,
        companyId: companyA.company.id,
      };

      expect(() => {
        scopeToOwnEmployee(otherEmployeeRecord, fakeReq);
      }).toThrow(NotFoundError);
    });

    it('allows a Manager to access employee records within their own department', () => {
      const fakeReq = {
        user: {
          userId: companyA.managerDeptA.id,
          role: 'manager' as const,
          companyId: companyA.company.id,
          departmentId: companyA.departmentA.id,
        },
      } as unknown as Request;

      const employeeInDeptA = {
        id: 'emp-rec-1',
        userId: companyA.employee1DeptA.id,
        departmentId: companyA.departmentA.id,
        companyId: companyA.company.id,
      };

      expect(() => {
        scopeToOwnEmployee(employeeInDeptA, fakeReq);
      }).not.toThrow();
    });

    it('rejects a Manager attempting to access an employee in a different department with 404 Not Found', () => {
      const fakeReq = {
        user: {
          userId: companyA.managerDeptA.id,
          role: 'manager' as const,
          companyId: companyA.company.id,
          departmentId: companyA.departmentA.id,
        },
      } as unknown as Request;

      const employeeInDeptB = {
        id: 'emp-rec-deptB',
        userId: 'some-user-in-b',
        departmentId: companyA.departmentB.id, // Different department
        companyId: companyA.company.id,
      };

      expect(() => {
        scopeToOwnEmployee(employeeInDeptB, fakeReq);
      }).toThrow(NotFoundError);
    });

    it('allows an HR Admin to access employee records across all departments in the company', () => {
      const fakeReq = {
        user: {
          userId: companyA.hrAdmin.id,
          role: 'hr_admin' as const,
          companyId: companyA.company.id,
          departmentId: null,
        },
      } as unknown as Request;

      const employeeInDeptB = {
        id: 'emp-rec-deptB',
        userId: 'some-user-in-b',
        departmentId: companyA.departmentB.id,
        companyId: companyA.company.id,
      };

      expect(() => {
        scopeToOwnEmployee(employeeInDeptB, fakeReq);
      }).not.toThrow();
    });
  });
});
