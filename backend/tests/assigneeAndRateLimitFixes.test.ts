import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/utils/prisma';
import { createTestTenantFixture, cleanupTestTenant, TestTenantFixture } from './testUtils';
import { signAccessToken } from '../src/utils/token';
import { hashPassword } from '../src/utils/password';

describe('Fix 1 & Fix 2 — Assignee-Type Authorization & Rate Limiting Escape Hatch', () => {
  let fixture: TestTenantFixture;
  const suffix = `fix12_${Date.now()}`;

  let mentorUser: { id: string; email: string; token: string };
  let mentorRecord: { id: string };
  let employeeRecord: any;
  let employeeTask: any;
  let managerTask: any;
  let mentorTask: any;

  beforeAll(async () => {
    fixture = await createTestTenantFixture(suffix);

    // 1. Create a designated mentor in Department A
    const passwordHash = await hashPassword('MentorPass123!');
    const mentorUserDb = await prisma.user.create({
      data: {
        email: `mentor.${suffix}@test.com`,
        passwordHash,
        role: 'employee',
        companyId: fixture.company.id,
        departmentId: fixture.departmentA.id,
        mustChangePassword: false,
      },
    });

    mentorRecord = await prisma.mentor.create({
      data: {
        userId: mentorUserDb.id,
        departmentId: fixture.departmentA.id,
        companyId: fixture.company.id,
        isActive: true,
      },
    });

    mentorUser = {
      id: mentorUserDb.id,
      email: mentorUserDb.email,
      token: signAccessToken({
        userId: mentorUserDb.id,
        role: 'employee',
        companyId: fixture.company.id,
        departmentId: fixture.departmentA.id,
      }),
    };

    // 2. Create a template with employee, manager, and mentor tasks
    const template = await prisma.onboardingTemplate.create({
      data: {
        name: `Engineering Workflow ${suffix}`,
        companyId: fixture.company.id,
        departmentId: fixture.departmentA.id,
        jobRole: 'Fullstack Engineer',
        isDefault: true,
        createdBy: fixture.hrAdmin.id,
        tasks: {
          create: [
            {
              title: 'Complete HR Paperwork',
              category: 'Compliance',
              orderIndex: 0,
              assigneeType: 'employee',
              dueOffsetDays: 1,
            },
            {
              title: 'Manager 1-on-1 Goal Setting',
              category: 'Management',
              orderIndex: 1,
              assigneeType: 'manager',
              dueOffsetDays: 3,
            },
            {
              title: 'Mentor Architecture Walkthrough',
              category: 'Mentorship',
              orderIndex: 2,
              assigneeType: 'mentor',
              dueOffsetDays: 5,
            },
          ],
        },
      },
      include: { tasks: true },
    });

    // 3. Create employee assigned to this template and mentor
    const createEmpRes = await request(app)
      .post('/employees')
      .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
      .send({
        name: 'Target New Hire',
        email: `newhire.${suffix}@test.com`,
        role: 'employee',
        initialPassword: 'TempPassword123!',
        departmentId: fixture.departmentA.id,
        jobRole: 'Fullstack Engineer',
        startDate: '2026-10-01',
        employmentType: 'full_time',
        mentorId: mentorRecord.id,
      });

    expect(createEmpRes.status).toBe(201);
    employeeRecord = createEmpRes.body.data;

    employeeTask = employeeRecord.tasks.find((t: any) => t.assigneeType === 'employee');
    managerTask = employeeRecord.tasks.find((t: any) => t.assigneeType === 'manager');
    mentorTask = employeeRecord.tasks.find((t: any) => t.assigneeType === 'mentor');

    expect(employeeTask).toBeDefined();
    expect(managerTask).toBeDefined();
    expect(mentorTask).toBeDefined();
  });

  afterAll(async () => {
    // Restore environment variable to clean state
    delete process.env.DISABLE_RATE_LIMITING;

    if (fixture?.company?.id) {
      await cleanupTestTenant(fixture.company.id);
    }
  });

  // =========================================================================
  // FIX 1: TASK COMPLETION MUST BE RESTRICTED TO CORRECT ASSIGNEE TYPE
  // =========================================================================
  describe('Fix 1 — Task Completion Assignee Type Authorization', () => {
    let employeeToken: string;

    beforeAll(async () => {
      // Generate token for the created target employee
      employeeToken = signAccessToken({
        userId: employeeRecord.userId,
        role: 'employee',
        companyId: fixture.company.id,
        departmentId: fixture.departmentA.id,
      });
    });

    it('rejects an Employee attempting to complete a task with assigneeType = "manager" with 403 WRONG_ASSIGNEE_TYPE and preserves task status', async () => {
      const res = await request(app)
        .patch(`/employees/${employeeRecord.id}/tasks/${managerTask.id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ status: 'completed' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('WRONG_ASSIGNEE_TYPE');
      expect(res.body.error.message).toContain('assigned manager');

      // Verify task status in database is untouched
      const dbTask = await prisma.employeeTask.findUnique({ where: { id: managerTask.id } });
      expect(dbTask?.status).toBe('pending');
      expect(dbTask?.completedAt).toBeNull();
    });

    it('rejects an Employee attempting to complete a task with assigneeType = "mentor" with 403 WRONG_ASSIGNEE_TYPE and preserves task status', async () => {
      const res = await request(app)
        .patch(`/employees/${employeeRecord.id}/tasks/${mentorTask.id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ status: 'completed' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('WRONG_ASSIGNEE_TYPE');
      expect(res.body.error.message).toContain('assigned mentor');

      // Verify task status in database is untouched
      const dbTask = await prisma.employeeTask.findUnique({ where: { id: mentorTask.id } });
      expect(dbTask?.status).toBe('pending');
      expect(dbTask?.completedAt).toBeNull();
    });

    it('allows an Employee to complete their own task where assigneeType = "employee"', async () => {
      const res = await request(app)
        .patch(`/employees/${employeeRecord.id}/tasks/${employeeTask.id}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ status: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.completedAt).toBeDefined();

      const dbTask = await prisma.employeeTask.findUnique({ where: { id: employeeTask.id } });
      expect(dbTask?.status).toBe('completed');
    });

    it('allows the Department Manager to complete a task where assigneeType = "manager"', async () => {
      const res = await request(app)
        .patch(`/employees/${employeeRecord.id}/tasks/${managerTask.id}`)
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`)
        .send({ status: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.completedAt).toBeDefined();

      const dbTask = await prisma.employeeTask.findUnique({ where: { id: managerTask.id } });
      expect(dbTask?.status).toBe('completed');
    });

    it('allows the Assigned Mentor to complete a task where assigneeType = "mentor"', async () => {
      const res = await request(app)
        .patch(`/employees/${employeeRecord.id}/tasks/${mentorTask.id}`)
        .set('Authorization', `Bearer ${mentorUser.token}`)
        .send({ status: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.completedAt).toBeDefined();

      const dbTask = await prisma.employeeTask.findUnique({ where: { id: mentorTask.id } });
      expect(dbTask?.status).toBe('completed');
    });

    it('preserves 404 behavior for genuine out-of-scope resources (cross-department, cross-employee, mentor touching non-mentor tasks)', async () => {
      // 1. Cross-department manager attempting to modify Dept A employee task -> 404
      const crossDeptRes = await request(app)
        .patch(`/employees/${employeeRecord.id}/tasks/${managerTask.id}`)
        .set('Authorization', `Bearer ${fixture.managerDeptB.token}`)
        .send({ status: 'pending' });

      expect(crossDeptRes.status).toBe(404);
      expect(crossDeptRes.body.error.code).toBe('NOT_FOUND');

      // 2. Unrelated employee attempting to modify target employee's task -> 404
      const crossEmpRes = await request(app)
        .patch(`/employees/${employeeRecord.id}/tasks/${employeeTask.id}`)
        .set('Authorization', `Bearer ${fixture.employee2DeptA.token}`)
        .send({ status: 'pending' });

      expect(crossEmpRes.status).toBe(404);
      expect(crossEmpRes.body.error.code).toBe('NOT_FOUND');

      // 3. Mentor attempting to modify mentee's manager task -> 404
      const mentorManagerRes = await request(app)
        .patch(`/employees/${employeeRecord.id}/tasks/${managerTask.id}`)
        .set('Authorization', `Bearer ${mentorUser.token}`)
        .send({ status: 'pending' });

      expect(mentorManagerRes.status).toBe(404);
      expect(mentorManagerRes.body.error.code).toBe('NOT_FOUND');
    });
  });

  // =========================================================================
  // FIX 2: ENVIRONMENT-GATED RATE LIMIT DISABLE FOR LOCAL TESTING
  // =========================================================================
  describe('Fix 2 — Environment-Gated Rate Limit Disable (DISABLE_RATE_LIMITING)', () => {
    const rateLimitEmail = `ratelimit_fix_${suffix}@test.com`;

    it('enforces rate limiting when DISABLE_RATE_LIMITING is unset or false (Phase 1 baseline)', async () => {
      delete process.env.DISABLE_RATE_LIMITING;

      // 5 attempts are allowed
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/auth/login')
          .set('x-test-rate-limit', 'true')
          .send({ email: rateLimitEmail, password: 'WrongPassword1!' });
      }

      // 6th attempt must be blocked with 429
      const blockedRes = await request(app)
        .post('/auth/login')
        .set('x-test-rate-limit', 'true')
        .send({ email: rateLimitEmail, password: 'WrongPassword1!' });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.error.code).toBe('TOO_MANY_LOGIN_ATTEMPTS');
    });

    it('bypasses 429 rate limiting on repeated login requests when DISABLE_RATE_LIMITING=true', async () => {
      process.env.DISABLE_RATE_LIMITING = 'true';

      // Send 8 repeated login requests with rate-limit flag
      for (let i = 0; i < 8; i++) {
        const res = await request(app)
          .post('/auth/login')
          .set('x-test-rate-limit', 'true')
          .send({ email: rateLimitEmail, password: 'WrongPassword1!' });

        // Should receive 401 INVALID_CREDENTIALS, NOT 429 TOO_MANY_LOGIN_ATTEMPTS
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      }
    });

    it('bypasses general rate limiting on repeated requests when DISABLE_RATE_LIMITING=true', async () => {
      process.env.DISABLE_RATE_LIMITING = 'true';

      // Send 105 requests to health endpoint with general rate limit flag
      for (let i = 0; i < 105; i++) {
        const res = await request(app)
          .get('/health')
          .set('x-test-general-rate-limit', 'true');

        expect(res.status).toBe(200);
      }
    });

    it('confirms DISABLE_RATE_LIMITING=true has no effect on authentication, authorization, or validation', async () => {
      process.env.DISABLE_RATE_LIMITING = 'true';

      // 1. Unauthenticated request to protected endpoint still returns 401
      const unauthRes = await request(app).get('/employees');
      expect(unauthRes.status).toBe(401);
      expect(unauthRes.body.error.code).toBe('MISSING_TOKEN');

      // 2. Forbidden role access still returns 403
      const forbiddenRes = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${fixture.employee1DeptA.token}`)
        .send({ name: 'Hacker' });
      expect(forbiddenRes.status).toBe(403);
      expect(forbiddenRes.body.error.code).toBe('FORBIDDEN');

      // 3. Validation rejection still returns 400
      const validationRes = await request(app)
        .post('/auth/login')
        .send({ email: 'not-an-email', password: '' });
      expect(validationRes.status).toBe(400);
      expect(validationRes.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
