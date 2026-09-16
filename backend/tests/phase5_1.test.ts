import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/utils/prisma';
import { createTestTenantFixture, cleanupTestTenant, TestTenantFixture } from './testUtils';
import { hashPassword } from '../src/utils/password';

describe('Phase 5.1 — Admin Data Foundations', () => {
  let fixture: TestTenantFixture;
  const suffix = `p51_${Date.now()}`;

  let customManagerUser: { id: string; email: string };
  let autoMatchTemplate: any;
  let manualOverrideTemplate: any;

  beforeAll(async () => {
    fixture = await createTestTenantFixture(suffix);

    // Create an extra manager user in Department B for manager selection tests
    const passwordHash = await hashPassword('ManagerPass123!');
    const mgrUserDb = await prisma.user.create({
      data: {
        email: `mgr2.${suffix}@test.com`,
        passwordHash,
        role: 'manager',
        companyId: fixture.company.id,
        departmentId: fixture.departmentB.id,
        mustChangePassword: false,
      },
    });
    customManagerUser = {
      id: mgrUserDb.id,
      email: mgrUserDb.email,
    };

    // Create Template 1: Auto-match candidate for role "DevOps Engineer" in Department A
    autoMatchTemplate = await prisma.onboardingTemplate.create({
      data: {
        name: `DevOps Auto Template ${suffix}`,
        companyId: fixture.company.id,
        departmentId: fixture.departmentA.id,
        jobRole: 'DevOps Engineer',
        isDefault: false,
        createdBy: fixture.hrAdmin.id,
        tasks: {
          create: [
            {
              title: 'DevOps Cloud Setup',
              description: 'Configure AWS IAM and kubectl',
              category: 'IT Setup',
              orderIndex: 0,
              assigneeType: 'employee',
              dueOffsetDays: 1,
            },
            {
              title: 'DevOps CI/CD Review',
              description: 'Review GitHub Actions pipelines',
              category: 'Engineering',
              orderIndex: 1,
              assigneeType: 'employee',
              dueOffsetDays: 3,
            },
          ],
        },
      },
      include: { tasks: true },
    });

    // Create Template 2: Distinct template to be used for manual override
    manualOverrideTemplate = await prisma.onboardingTemplate.create({
      data: {
        name: `Special Override Template ${suffix}`,
        companyId: fixture.company.id,
        departmentId: fixture.departmentA.id,
        jobRole: 'Consultant',
        isDefault: false,
        createdBy: fixture.hrAdmin.id,
        tasks: {
          create: [
            {
              title: 'Client NDA Signing',
              description: 'Sign external contractor agreement',
              category: 'HR Paperwork',
              orderIndex: 0,
              assigneeType: 'employee',
              dueOffsetDays: 0,
            },
            {
              title: 'Partner Portal Access',
              description: 'Provision partner sandbox keys',
              category: 'IT Setup',
              orderIndex: 1,
              assigneeType: 'employee',
              dueOffsetDays: 2,
            },
            {
              title: 'Executive Welcome Call',
              description: 'Introductory sync with VP',
              category: 'Orientation',
              orderIndex: 2,
              assigneeType: 'manager',
              dueOffsetDays: 5,
            },
          ],
        },
      },
      include: { tasks: true },
    });
  });

  afterAll(async () => {
    if (fixture?.company?.id) {
      await cleanupTestTenant(fixture.company.id);
    }
  });

  // =========================================================================
  // TASK 1: Department CRUD for HR Admin
  // =========================================================================
  describe('Task 1 — Department CRUD for HR Admin', () => {
    let createdDeptId: string;

    it('allows HR Admin to create a new department, list it, update its name, and delete it when empty', async () => {
      // 1. Create department
      const createRes = await request(app)
        .post('/departments')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({ name: `Product Design ${suffix}` });

      expect(createRes.status).toBe(201);
      expect(createRes.body.status).toBe('ok');
      expect(createRes.body.data.name).toBe(`Product Design ${suffix}`);
      expect(createRes.body.data.companyId).toBe(fixture.company.id);
      createdDeptId = createRes.body.data.id;

      // 2. List departments and verify newly created department is present
      const listRes = await request(app)
        .get('/departments')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(listRes.status).toBe(200);
      const matched = listRes.body.data.find((d: any) => d.id === createdDeptId);
      expect(matched).toBeDefined();
      expect(matched.name).toBe(`Product Design ${suffix}`);

      // 3. Get single department
      const getRes = await request(app)
        .get(`/departments/${createdDeptId}`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.id).toBe(createdDeptId);

      // 4. Update / rename department
      const updateRes = await request(app)
        .patch(`/departments/${createdDeptId}`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({ name: `Product & Design ${suffix}` });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.name).toBe(`Product & Design ${suffix}`);

      // 5. Delete empty department
      const deleteRes = await request(app)
        .delete(`/departments/${createdDeptId}`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.data.success).toBe(true);

      // 6. Confirm 404 after deletion
      const confirmRes = await request(app)
        .get(`/departments/${createdDeptId}`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(confirmRes.status).toBe(404);
    });

    it('rejects duplicate department name within the same company with 400', async () => {
      const res = await request(app)
        .post('/departments')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({ name: fixture.departmentA.name });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('DEPARTMENT_ALREADY_EXISTS');
    });

    it('prevents deletion of a department that has active employees and returns clear DEPARTMENT_NOT_EMPTY error', async () => {
      // Create empty department
      const dept = await prisma.department.create({
        data: {
          name: `Temp Employee Dept ${suffix}`,
          companyId: fixture.company.id,
        },
      });

      // Create an employee in that department
      await prisma.employee.create({
        data: {
          companyId: fixture.company.id,
          departmentId: dept.id,
          name: 'Employee in Dept',
          email: `dept.emp.${Date.now()}@test.com`,
          jobRole: 'Specialist',
          startDate: new Date('2026-10-01'),
          employmentType: 'full_time',
        },
      });

      const res = await request(app)
        .delete(`/departments/${dept.id}`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('DEPARTMENT_NOT_EMPTY');
      expect(res.body.error.message).toContain('employee');

      // Verify department was not deleted
      const checkDept = await prisma.department.findUnique({
        where: { id: dept.id },
      });
      expect(checkDept).not.toBeNull();
    });

    it('prevents deletion of a department that has templates assigned', async () => {
      // Create empty department
      const dept = await prisma.department.create({
        data: {
          name: `Temp Template Dept ${suffix}`,
          companyId: fixture.company.id,
        },
      });

      // Create a template in that department
      await prisma.onboardingTemplate.create({
        data: {
          name: `Sample Template ${suffix}`,
          companyId: fixture.company.id,
          departmentId: dept.id,
          isDefault: true,
          createdBy: fixture.hrAdmin.id,
        },
      });

      const res = await request(app)
        .delete(`/departments/${dept.id}`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('DEPARTMENT_NOT_EMPTY');
      expect(res.body.error.message).toContain('template');
    });

    it('prevents deletion of a department that has active mentors', async () => {
      // Create empty department
      const dept = await prisma.department.create({
        data: {
          name: `Temp Mentor Dept ${suffix}`,
          companyId: fixture.company.id,
        },
      });

      // Add a mentor to this department
      await prisma.mentor.create({
        data: {
          userId: customManagerUser.id,
          departmentId: dept.id,
          companyId: fixture.company.id,
          isActive: true,
        },
      });

      const res = await request(app)
        .delete(`/departments/${dept.id}`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('DEPARTMENT_NOT_EMPTY');
      expect(res.body.error.message).toContain('mentor');
    });

    it('strictly rejects Manager and Employee from performing department CRUD actions (403 Forbidden)', async () => {
      // Manager attempts
      const mgrPost = await request(app)
        .post('/departments')
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`)
        .send({ name: `Hacked Dept ${suffix}` });
      expect(mgrPost.status).toBe(403);

      const mgrPatch = await request(app)
        .patch(`/departments/${fixture.departmentA.id}`)
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`)
        .send({ name: 'Hacked Name' });
      expect(mgrPatch.status).toBe(403);

      const mgrDelete = await request(app)
        .delete(`/departments/${fixture.departmentA.id}`)
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`);
      expect(mgrDelete.status).toBe(403);

      // Employee attempts
      const empPost = await request(app)
        .post('/departments')
        .set('Authorization', `Bearer ${fixture.employee1DeptA.token}`)
        .send({ name: `Hacked Dept 2 ${suffix}` });
      expect(empPost.status).toBe(403);

      const empDelete = await request(app)
        .delete(`/departments/${fixture.departmentA.id}`)
        .set('Authorization', `Bearer ${fixture.employee1DeptA.token}`);
      expect(empDelete.status).toBe(403);
    });
  });

  // =========================================================================
  // TASK 1: Immediate Usability (No server restart or reseed required)
  // =========================================================================
  describe('Task 1 — Department Immediate Usability', () => {
    it('allows a newly created department to be immediately used in employee and template creation within the same test run', async () => {
      // 1. HR Admin creates a new department through the API
      const createDeptRes = await request(app)
        .post('/departments')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({ name: `Security & Compliance ${suffix}` });

      expect(createDeptRes.status).toBe(201);
      const newDeptId = createDeptRes.body.data.id;

      // 2. Immediately create a template in that new department
      const createTmplRes = await request(app)
        .post('/templates')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: `Compliance Officer Checklist ${suffix}`,
          departmentId: newDeptId,
          jobRole: 'Compliance Officer',
          isDefault: true,
          tasks: [
            {
              title: 'Background Check Verification',
              category: 'HR Paperwork',
              orderIndex: 0,
              assigneeType: 'employee',
              dueOffsetDays: 1,
            },
          ],
        });

      expect(createTmplRes.status).toBe(201);
      expect(createTmplRes.body.data.departmentId).toBe(newDeptId);

      // 3. Immediately create an employee in that new department
      const createEmpRes = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: 'Sarah Connor',
          email: `sarah.connor.${suffix}@test.com`,
          departmentId: newDeptId,
          jobRole: 'Compliance Officer',
          startDate: '2026-10-01',
          employmentType: 'full_time',
        });

      expect(createEmpRes.status).toBe(201);
      expect(createEmpRes.body.data.departmentId).toBe(newDeptId);
      expect(createEmpRes.body.data.tasks.length).toBe(1);
      expect(createEmpRes.body.data.tasks[0].title).toBe('Background Check Verification');
    });
  });

  // =========================================================================
  // TASK 2: Manager Selection at Employee Creation
  // =========================================================================
  describe('Task 2 — Manager Selection at Employee Creation', () => {
    it('creates employee with explicit manager_id and returns manager association in single and list responses', async () => {
      const res = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: 'John Matrix',
          email: `john.matrix.${suffix}@test.com`,
          departmentId: fixture.departmentA.id,
          jobRole: 'Security Specialist',
          startDate: '2026-10-01',
          employmentType: 'full_time',
          managerId: fixture.managerDeptA.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.managerId).toBe(fixture.managerDeptA.id);
      expect(res.body.data.manager).toBeDefined();
      expect(res.body.data.manager.id).toBe(fixture.managerDeptA.id);
      expect(res.body.data.manager.email).toBe(fixture.managerDeptA.email);

      const empId = res.body.data.id;

      // Verify GET /employees/:id returns manager details
      const getRes = await request(app)
        .get(`/employees/${empId}`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.managerId).toBe(fixture.managerDeptA.id);
      expect(getRes.body.data.manager.email).toBe(fixture.managerDeptA.email);

      // Verify GET /employees list includes manager details
      const listRes = await request(app)
        .get('/employees')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(listRes.status).toBe(200);
      const found = listRes.body.data.find((e: any) => e.id === empId);
      expect(found).toBeDefined();
      expect(found.manager).toBeDefined();
      expect(found.manager.email).toBe(fixture.managerDeptA.email);
    });

    it('creates employee with manager_id omitted successfully (optional field regression check)', async () => {
      const res = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: 'Ellen Ripley',
          email: `ellen.ripley.${suffix}@test.com`,
          departmentId: fixture.departmentA.id,
          jobRole: 'Flight Officer',
          startDate: '2026-10-01',
          employmentType: 'full_time',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.managerId).toBeNull();
      expect(res.body.data.manager).toBeNull();
    });

    it('rejects employee creation with invalid or non-manager manager_id', async () => {
      // 1. Try assigning a user with role='employee' as manager
      const nonMgrRes = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: 'Kyle Reese',
          email: `kyle.reese.${suffix}@test.com`,
          departmentId: fixture.departmentA.id,
          jobRole: 'Scout',
          startDate: '2026-10-01',
          employmentType: 'full_time',
          managerId: fixture.employee1DeptA.id,
        });

      expect(nonMgrRes.status).toBe(400);
      expect(nonMgrRes.body.error.code).toBe('INVALID_MANAGER');

      // 2. Try assigning a non-existent UUID as manager
      const fakeUuidRes = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: 'Kyle Reese',
          email: `kyle.reese2.${suffix}@test.com`,
          departmentId: fixture.departmentA.id,
          jobRole: 'Scout',
          startDate: '2026-10-01',
          employmentType: 'full_time',
          managerId: '00000000-0000-0000-0000-000000000999',
        });

      expect(fakeUuidRes.status).toBe(400);
      expect(fakeUuidRes.body.error.code).toBe('INVALID_MANAGER');
    });
  });

  // =========================================================================
  // TASK 3: Manual Template Override at Employee Creation
  // =========================================================================
  describe('Task 3 — Manual Template Override at Employee Creation', () => {
    it('uses explicit template_id for snapshotting, NOT the auto-matched one, when they clearly differ', async () => {
      // Role is "DevOps Engineer" in Department A.
      // Auto-matching would normally pick autoMatchTemplate ("DevOps Auto Template", 2 tasks).
      // But we explicitly provide manualOverrideTemplate ("Special Override Template", 3 tasks).
      const res = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: 'DevOps With Custom Template',
          email: `devops.custom.${suffix}@test.com`,
          departmentId: fixture.departmentA.id,
          jobRole: 'DevOps Engineer',
          startDate: '2026-10-01',
          employmentType: 'full_time',
          templateId: manualOverrideTemplate.id,
        });

      expect(res.status).toBe(201);
      const employee = res.body.data;
      expect(employee.tasks.length).toBe(3);

      const taskTitles = employee.tasks.map((t: any) => t.title);
      expect(taskTitles).toContain('Client NDA Signing');
      expect(taskTitles).toContain('Partner Portal Access');
      expect(taskTitles).toContain('Executive Welcome Call');

      // Assert it did NOT snapshot autoMatchTemplate tasks
      expect(taskTitles).not.toContain('DevOps Cloud Setup');
      expect(taskTitles).not.toContain('DevOps CI/CD Review');
    });

    it('runs Phase 2 auto-match cascade when template_id is omitted', async () => {
      // Role is "DevOps Engineer" with NO templateId specified -> picks autoMatchTemplate
      const res = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: 'DevOps Standard',
          email: `devops.standard.${suffix}@test.com`,
          departmentId: fixture.departmentA.id,
          jobRole: 'DevOps Engineer',
          startDate: '2026-10-01',
          employmentType: 'full_time',
        });

      expect(res.status).toBe(201);
      const employee = res.body.data;
      expect(employee.tasks.length).toBe(2);

      const taskTitles = employee.tasks.map((t: any) => t.title);
      expect(taskTitles).toContain('DevOps Cloud Setup');
      expect(taskTitles).toContain('DevOps CI/CD Review');
    });

    it('confirms snapshot-on-assignment invariant for both auto-match and manual-override paths', async () => {
      // 1. Create employee with manual override
      const createRes = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: 'Snapshot Test Employee',
          email: `snapshot.test.${suffix}@test.com`,
          departmentId: fixture.departmentA.id,
          jobRole: 'Consultant',
          startDate: '2026-10-01',
          employmentType: 'full_time',
          templateId: manualOverrideTemplate.id,
        });

      expect(createRes.status).toBe(201);
      const initialTaskCount = createRes.body.data.tasks.length;
      expect(initialTaskCount).toBe(3);

      // 2. Modify manualOverrideTemplate by adding a 4th task
      const updatedTemplate = await request(app)
        .put(`/templates/${manualOverrideTemplate.id}`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          tasks: [
            ...manualOverrideTemplate.tasks.map((t: any) => ({
              title: t.title,
              description: t.description,
              category: t.category,
              orderIndex: t.orderIndex,
              assigneeType: t.assigneeType,
              dueOffsetDays: t.dueOffsetDays,
            })),
            {
              title: 'Fourth Later Added Task',
              description: 'Added after employee was created',
              category: 'Operations',
              orderIndex: 3,
              assigneeType: 'employee',
              dueOffsetDays: 10,
            },
          ],
        });

      expect(updatedTemplate.status).toBe(200);

      // 3. Fetch employee record again and assert tasks did NOT change
      const fetchEmployeeRes = await request(app)
        .get(`/employees/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(fetchEmployeeRes.status).toBe(200);
      expect(fetchEmployeeRes.body.data.tasks.length).toBe(3);
      const currentTitles = fetchEmployeeRes.body.data.tasks.map((t: any) => t.title);
      expect(currentTitles).not.toContain('Fourth Later Added Task');
    });
  });
});
