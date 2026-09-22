import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/utils/prisma';
import bcrypt from 'bcrypt';
import { createTestTenantFixture, cleanupTestTenant, TestTenantFixture } from './testUtils';
import { signPlatformAdminToken } from '../src/utils/platformAdminToken';

describe('Phase 5.7 — Platform Administration & Tenant Onboarding Tests', () => {
  let tenantFixture: TestTenantFixture;
  const suffix = `p57_${Date.now()}`;

  let testAdminEmail = `admin_${suffix}@platform.internal`;
  let testAdminPassword = 'PlatformSecretPassword123!';
  let platformAdminId: string;
  let platformAdminToken: string;

  const createdCompanyIds: string[] = [];

  beforeAll(async () => {
    // 1. Create a tenant fixture for cross-system isolation testing
    tenantFixture = await createTestTenantFixture(suffix);

    // 2. Create a dedicated platform admin in platform_admins table
    const passwordHash = await bcrypt.hash(testAdminPassword, 10);
    const admin = await prisma.platformAdmin.create({
      data: {
        email: testAdminEmail,
        passwordHash,
      },
    });
    platformAdminId = admin.id;

    // 3. Pre-generate platform admin token or login
    const loginRes = await request(app)
      .post('/platform-admin/auth/login')
      .send({
        email: testAdminEmail,
        password: testAdminPassword,
      });

    expect(loginRes.status).toBe(200);
    platformAdminToken = loginRes.body.token || loginRes.body.accessToken || loginRes.body.data?.accessToken;
  });

  afterAll(async () => {
    // Clean up created companies (cascades to all company records)
    for (const companyId of createdCompanyIds) {
      await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
    }

    // Clean up test platform admin
    if (platformAdminId) {
      await prisma.platformAdmin.delete({
        where: { id: platformAdminId },
      }).catch(() => {});
    }

    // Clean up tenant fixture
    if (tenantFixture) {
      await cleanupTestTenant(tenantFixture.company.id);
    }
  });

  describe('1. Platform Admin Authentication', () => {
    it('successfully logs in with valid platform admin credentials', async () => {
      const res = await request(app)
        .post('/platform-admin/auth/login')
        .send({
          email: testAdminEmail,
          password: testAdminPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(typeof res.body.token).toBe('string');
      expect(res.body.admin).toBeDefined();
      expect(res.body.admin.id).toBe(platformAdminId);
      expect(res.body.admin.email).toBe(testAdminEmail);
      expect(res.body.admin.passwordHash).toBeUndefined();
    });

    it('rejects login with incorrect password with 401', async () => {
      const res = await request(app)
        .post('/platform-admin/auth/login')
        .send({
          email: testAdminEmail,
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('rejects login with nonexistent email with 401', async () => {
      const res = await request(app)
        .post('/platform-admin/auth/login')
        .send({
          email: `nonexistent_${suffix}@nowhere.com`,
          password: testAdminPassword,
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('rejects login with invalid email formatting with 400', async () => {
      const res = await request(app)
        .post('/platform-admin/auth/login')
        .send({
          email: 'not-an-email',
          password: testAdminPassword,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('2. Cross-System Auth Isolation (The Invariant)', () => {
    it('rejects unauthenticated requests to platform admin endpoints with 401', async () => {
      const res = await request(app).get('/platform-admin/companies');
      expect(res.status).toBe(401);
    });

    it('rejects tenant HR admin token on platform admin endpoints with 401', async () => {
      const res = await request(app)
        .get('/platform-admin/companies')
        .set('Authorization', `Bearer ${tenantFixture.hrAdminToken}`);

      expect(res.status).toBe(401);
    });

    it('rejects tenant manager token on platform admin endpoints with 401', async () => {
      const res = await request(app)
        .get('/platform-admin/companies')
        .set('Authorization', `Bearer ${tenantFixture.managerToken}`);

      expect(res.status).toBe(401);
    });

    it('rejects tenant employee token on platform admin endpoints with 401', async () => {
      const res = await request(app)
        .get('/platform-admin/companies')
        .set('Authorization', `Bearer ${tenantFixture.employeeToken}`);

      expect(res.status).toBe(401);
    });

    it('rejects platform admin token on tenant endpoints (e.g. GET /employees) with 401', async () => {
      const res = await request(app)
        .get('/employees')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(401);
    });

    it('rejects platform admin token on tenant endpoints (e.g. GET /departments) with 401', async () => {
      const res = await request(app)
        .get('/departments')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(401);
    });

    it('rejects platform admin token on employee self-service endpoints with 401', async () => {
      const res = await request(app)
        .get('/employees/me/tasks')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(401);
    });
  });

  describe('3. Company Onboarding & Atomic Provisioning', () => {
    const newCompanyName = `Acme Corp ${suffix}`;
    const newHrEmail = `hr.admin_${suffix}@acmecorp.com`;
    const newHrPassword = 'TemporaryPassword123!';

    let createdCompanyId: string;
    let createdHrUserId: string;

    it('atomically creates company and initial HR admin with mustChangePassword=true', async () => {
      const res = await request(app)
        .post('/platform-admin/companies')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          companyName: newCompanyName,
          hrAdminEmail: newHrEmail,
          hrAdminPassword: newHrPassword,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ok');
      expect(res.body.data).toBeDefined();

      const { company, hrAdmin } = res.body.data;
      expect(company.id).toBeDefined();
      expect(company.name).toBe(newCompanyName);
      expect(hrAdmin.id).toBeDefined();
      expect(hrAdmin.email).toBe(newHrEmail);
      expect(hrAdmin.mustChangePassword).toBe(true);
      expect(hrAdmin.passwordHash).toBeUndefined();

      createdCompanyId = company.id;
      createdHrUserId = hrAdmin.id;
      createdCompanyIds.push(createdCompanyId);

      // Verify directly in DB
      const dbCompany = await prisma.company.findUnique({
        where: { id: createdCompanyId },
      });
      expect(dbCompany).not.toBeNull();
      expect(dbCompany?.name).toBe(newCompanyName);

      const dbUser = await prisma.user.findUnique({
        where: { id: createdHrUserId },
      });
      expect(dbUser).not.toBeNull();
      expect(dbUser?.companyId).toBe(createdCompanyId);
      expect(dbUser?.role).toBe('hr_admin');
      expect(dbUser?.mustChangePassword).toBe(true);
    });

    it('allows newly created HR Admin to authenticate via /auth/login with mustChangePassword challenge', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: newHrEmail,
          password: newHrPassword,
        });

      expect(res.status).toBe(200);
      const isMustChange = res.body.data?.mustChangePassword ?? res.body.mustChangePassword;
      expect(isMustChange).toBe(true);
      const returnedEmail = res.body.data?.email ?? res.body.email;
      expect(returnedEmail).toBe(newHrEmail);
    });

    it('rolls back completely if HR admin email already exists in system', async () => {
      const duplicateCompanyAttempt = `Duplicate Co ${suffix}`;

      // Try creating another company with the same HR admin email
      const res = await request(app)
        .post('/platform-admin/companies')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          companyName: duplicateCompanyAttempt,
          hrAdminEmail: newHrEmail, // Already in use
          hrAdminPassword: 'SomeOtherPassword123!',
        });

      expect(res.status).toBe(409);

      // Verify that the duplicate company was NOT persisted (atomic transaction rollback)
      const orphanCompany = await prisma.company.findFirst({
        where: { name: duplicateCompanyAttempt },
      });
      expect(orphanCompany).toBeNull();
    });

    it('validates required fields with 400 when onboarding company', async () => {
      const res = await request(app)
        .post('/platform-admin/companies')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          companyName: '',
          hrAdminEmail: 'not-an-email',
          hrAdminPassword: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('4. Company Listing & Drilldown Views', () => {
    it('lists companies with pagination and counts', async () => {
      const res = await request(app)
        .get('/platform-admin/companies')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);

      const found = res.body.data.find((c: any) => c.id === tenantFixture.company.id);
      expect(found).toBeDefined();
      expect(found._count).toBeDefined();
      expect(typeof found._count.employees).toBe('number');
      expect(typeof found._count.departments).toBe('number');
    });

    it('supports searching companies by name', async () => {
      const res = await request(app)
        .get('/platform-admin/companies')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .query({ search: suffix });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      res.body.data.forEach((c: any) => {
        expect(c.name.toLowerCase()).toContain(suffix.toLowerCase());
      });
    });

    it('gets detailed drilldown statistics for a specific company', async () => {
      const res = await request(app)
        .get(`/platform-admin/companies/${tenantFixture.company.id}`)
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.data).toBeDefined();

      const data = res.body.data;
      expect(data.company.id).toBe(tenantFixture.company.id);
      expect(data.company.name).toBe(tenantFixture.company.name);
      expect(data.hrAdmin).toBeDefined();
      expect(data.hrAdmin.email).toBe(tenantFixture.hrAdmin.email);
      expect(typeof data.stats.totalEmployees).toBe('number');
      expect(typeof data.stats.totalDepartments).toBe('number');
      expect(typeof data.stats.totalTemplates).toBe('number');
      expect(typeof data.stats.completionRate).toBe('number');
    });

    it('returns 404 for nonexistent company ID drilldown', async () => {
      const res = await request(app)
        .get('/platform-admin/companies/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${platformAdminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });
  });
});
