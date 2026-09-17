import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/utils/prisma';
import { createTestTenantFixture, cleanupTestTenant, TestTenantFixture } from './testUtils';

describe('Phase 5.3 — Search, Filtering & Pagination', () => {
  let fixture: TestTenantFixture;
  const suffix = `p53_${Date.now()}`;

  let emp1DeptA: any;
  let emp2DeptA: any;
  let emp3DeptA: any;
  let emp4DeptB: any;

  let template1: any;
  let template2: any;
  let doc1: any;
  let doc2: any;

  beforeAll(async () => {
    fixture = await createTestTenantFixture(suffix);

    // Create 3 templates in company
    template1 = await prisma.onboardingTemplate.create({
      data: {
        name: `Alpha Backend Engineer Template ${suffix}`,
        companyId: fixture.company.id,
        departmentId: fixture.departmentA.id,
        jobRole: 'Backend Engineer',
        isDefault: true,
        createdBy: fixture.hrAdmin.id,
        tasks: {
          create: [
            {
              title: 'Alpha Setup Git',
              category: 'IT Setup',
              orderIndex: 0,
              assigneeType: 'employee',
              dueOffsetDays: 1,
            },
          ],
        },
      },
    });

    template2 = await prisma.onboardingTemplate.create({
      data: {
        name: `Beta Design Lead Template ${suffix}`,
        companyId: fixture.company.id,
        departmentId: fixture.departmentB.id,
        jobRole: 'Product Designer',
        isDefault: false,
        createdBy: fixture.hrAdmin.id,
        tasks: {
          create: [
            {
              title: 'Figma Access Setup',
              category: 'Design Tools',
              orderIndex: 0,
              assigneeType: 'employee',
              dueOffsetDays: 2,
            },
          ],
        },
      },
    });

    // Create multiple employees across departments with distinct names, roles, emails, and task statuses
    // 1. Dept A: Alice (Backend Engineer, Not Started - 0 of 2 tasks complete)
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    emp1DeptA = await prisma.employee.create({
      data: {
        companyId: fixture.company.id,
        departmentId: fixture.departmentA.id,
        managerId: fixture.managerDeptA.id,
        userId: fixture.employee1DeptA.id,
        name: `Alice Wonder ${suffix}`,
        email: `alice_${suffix}@test.com`,
        jobRole: 'Backend Engineer',
        startDate: new Date(),
        employmentType: 'full_time',
        tasks: {
          create: [
            {
              title: 'Task 1 Pending',
              category: 'IT',
              assigneeType: 'employee',
              status: 'pending',
              orderIndex: 0,
              dueDate: futureDate,
            },
            {
              title: 'Task 2 Pending',
              category: 'Orientation',
              assigneeType: 'employee',
              status: 'pending',
              orderIndex: 1,
              dueDate: futureDate,
            },
          ],
        },
      },
    });

    // 2. Dept A: Bob (Frontend Specialist, In Progress - 1 of 2 tasks complete)
    emp2DeptA = await prisma.employee.create({
      data: {
        companyId: fixture.company.id,
        departmentId: fixture.departmentA.id,
        managerId: fixture.managerDeptA.id,
        userId: fixture.employee2DeptA.id,
        name: `Bob Builder ${suffix}`,
        email: `bob_${suffix}@test.com`,
        jobRole: 'Frontend Specialist',
        startDate: new Date(),
        employmentType: 'full_time',
        tasks: {
          create: [
            {
              title: 'Task 1 Done',
              category: 'IT',
              assigneeType: 'employee',
              status: 'completed',
              completedAt: new Date(),
              orderIndex: 0,
              dueDate: futureDate,
            },
            {
              title: 'Task 2 Pending',
              category: 'Orientation',
              assigneeType: 'employee',
              status: 'pending',
              orderIndex: 1,
              dueDate: futureDate,
            },
          ],
        },
      },
    });

    // 3. Dept A: Charlie (DevOps Master, Overdue - task not completed and dueDate in past)
    emp3DeptA = await prisma.employee.create({
      data: {
        companyId: fixture.company.id,
        departmentId: fixture.departmentA.id,
        managerId: fixture.managerDeptA.id,
        name: `Charlie Overdue ${suffix}`,
        email: `charlie_${suffix}@test.com`,
        jobRole: 'DevOps Master',
        startDate: new Date(),
        employmentType: 'full_time',
        tasks: {
          create: [
            {
              title: 'Urgent Past Due Task',
              category: 'Security',
              assigneeType: 'employee',
              status: 'pending',
              orderIndex: 0,
              dueDate: pastDate,
            },
          ],
        },
      },
    });

    // 4. Dept B: Diana (Product Designer, Complete - all tasks completed)
    emp4DeptB = await prisma.employee.create({
      data: {
        companyId: fixture.company.id,
        departmentId: fixture.departmentB.id,
        managerId: fixture.managerDeptB.id,
        userId: null,
        name: `Diana Prince ${suffix}`,
        email: `diana_${suffix}@test.com`,
        jobRole: 'Product Designer',
        startDate: new Date(),
        employmentType: 'contract',
        tasks: {
          create: [
            {
              title: 'Task 1 Complete',
              category: 'Design',
              assigneeType: 'employee',
              status: 'completed',
              completedAt: new Date(),
              orderIndex: 0,
              dueDate: futureDate,
            },
          ],
        },
      },
    });

    // Create 2 test documents for document pagination & search testing
    doc1 = await prisma.document.create({
      data: {
        companyId: fixture.company.id,
        uploadedBy: fixture.hrAdmin.id,
        filename: `Company_Policy_Guide_${suffix}.pdf`,
        storagePath: `/tmp/fake_${suffix}_1.pdf`,
        status: 'ready',
      },
    });

    doc2 = await prisma.document.create({
      data: {
        companyId: fixture.company.id,
        uploadedBy: fixture.hrAdmin.id,
        filename: `Engineering_Handbook_${suffix}.docx`,
        storagePath: `/tmp/fake_${suffix}_2.docx`,
        status: 'ready',
      },
    });
  });

  afterAll(async () => {
    await cleanupTestTenant(fixture.company.id);
  });

  describe('Task 1 — Pagination & Envelope Format', () => {
    it('GET /employees returns uniform envelope with pagination metadata and defaults limit to 20', async () => {
      const res = await request(app)
        .get('/employees')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(20);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(4);
      expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(1);
      expect(typeof res.body.pagination.hasNextPage).toBe('boolean');
      expect(typeof res.body.pagination.hasPrevPage).toBe('boolean');
    });

    it('clamps limit to maximum 100 when client requests limit=1000', async () => {
      const res = await request(app)
        .get('/employees?limit=1000')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(100);
    });

    it('returns non-overlapping records across successive pages', async () => {
      const page1Res = await request(app)
        .get('/employees?page=1&limit=2')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      const page2Res = await request(app)
        .get('/employees?page=2&limit=2')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(page1Res.status).toBe(200);
      expect(page2Res.status).toBe(200);
      expect(page1Res.body.data.length).toBe(2);
      expect(page2Res.body.data.length).toBe(2);

      const page1Ids = page1Res.body.data.map((e: any) => e.id);
      const page2Ids = page2Res.body.data.map((e: any) => e.id);

      const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
      expect(overlap).toHaveLength(0);
      expect(page1Res.body.pagination.hasNextPage).toBe(true);
      expect(page1Res.body.pagination.hasPrevPage).toBe(false);
      expect(page2Res.body.pagination.hasPrevPage).toBe(true);
    });

    it('GET /templates returns uniform pagination envelope and supports limit/offset', async () => {
      const res = await request(app)
        .get('/templates?page=1&limit=1')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.limit).toBe(1);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(2);
      expect(res.body.pagination.hasNextPage).toBe(true);
    });

    it('GET /departments returns uniform pagination envelope and supports limit/offset', async () => {
      const res = await request(app)
        .get('/departments?limit=1')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(2);
    });

    it('GET /documents returns standard pagination envelope', async () => {
      const res = await request(app)
        .get('/documents?page=1&limit=1')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.documents).toBeUndefined();
      expect(res.body.data.length).toBe(1);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(2);
    });

    it('GET /users returns uniform pagination envelope and supports limit clamping', async () => {
      const res = await request(app)
        .get('/users?limit=500')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination.limit).toBe(100);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Task 2 — Server-side Case-Insensitive Partial-Match Search', () => {
    it('searches /employees by name (case-insensitive substring)', async () => {
      const res = await request(app)
        .get(`/employees?search=alice%20won`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.some((e: any) => e.id === emp1DeptA.id)).toBe(true);
      expect(res.body.data.every((e: any) => e.name.toLowerCase().includes('alice won') || e.email.toLowerCase().includes('alice won'))).toBe(true);
    });

    it('searches /employees by email', async () => {
      const res = await request(app)
        .get(`/employees?search=bob_${suffix}`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(emp2DeptA.id);
    });

    it('searches /employees by jobRole', async () => {
      const res = await request(app)
        .get(`/employees?search=devops%20master`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(emp3DeptA.id);
    });

    it('Manager search strictly scopes to manager department and NEVER leaks other departments', async () => {
      // Manager of Dept A searches for "Product Designer" (which belongs to Diana in Dept B)
      const res = await request(app)
        .get(`/employees?search=Product%20Designer`)
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`);

      expect(res.status).toBe(200);
      // Manager Dept A should NOT see Diana in Dept B
      expect(res.body.data.some((e: any) => e.id === emp4DeptB.id)).toBe(false);
      expect(res.body.data).toHaveLength(0);

      // But when HR Admin searches for "Product Designer", Diana is found
      const hrRes = await request(app)
        .get(`/employees?search=Product%20Designer`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(hrRes.status).toBe(200);
      expect(hrRes.body.data.some((e: any) => e.id === emp4DeptB.id)).toBe(true);
    });

    it('searches /templates by name and jobRole', async () => {
      const nameRes = await request(app)
        .get(`/templates?search=alpha%20backend`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(nameRes.status).toBe(200);
      expect(nameRes.body.data.some((t: any) => t.id === template1.id)).toBe(true);

      const roleRes = await request(app)
        .get(`/templates?search=product%20designer`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(roleRes.status).toBe(200);
      expect(roleRes.body.data.some((t: any) => t.id === template2.id)).toBe(true);
    });

    it('searches /departments by name', async () => {
      const res = await request(app)
        .get(`/departments?search=Engineering`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.some((d: any) => d.id === fixture.departmentA.id)).toBe(true);
      expect(res.body.data.some((d: any) => d.id === fixture.departmentB.id)).toBe(false);
    });

    it('searches /documents by filename', async () => {
      const res = await request(app)
        .get(`/documents?search=Engineering_Handbook`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(doc2.id);
    });
  });

  describe('Task 3 — Filtering & Combinations', () => {
    it('filters /employees by departmentId', async () => {
      const res = await request(app)
        .get(`/employees?departmentId=${fixture.departmentB.id}`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.every((e: any) => e.departmentId === fixture.departmentB.id)).toBe(true);
      expect(res.body.data.some((e: any) => e.id === emp4DeptB.id)).toBe(true);
      expect(res.body.data.some((e: any) => e.id === emp1DeptA.id)).toBe(false);
    });

    it('filters /employees by status=not_started', async () => {
      const res = await request(app)
        .get(`/employees?status=not_started`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.some((e: any) => e.id === emp1DeptA.id)).toBe(true);
      expect(res.body.data.some((e: any) => e.id === emp2DeptA.id)).toBe(false); // in_progress
      expect(res.body.data.some((e: any) => e.id === emp4DeptB.id)).toBe(false); // complete
    });

    it('filters /employees by status=in_progress', async () => {
      const res = await request(app)
        .get(`/employees?status=in_progress`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.some((e: any) => e.id === emp2DeptA.id)).toBe(true);
      expect(res.body.data.some((e: any) => e.id === emp1DeptA.id)).toBe(false);
    });

    it('filters /employees by status=complete', async () => {
      const res = await request(app)
        .get(`/employees?status=complete`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.some((e: any) => e.id === emp4DeptB.id)).toBe(true);
      expect(res.body.data.some((e: any) => e.id === emp1DeptA.id)).toBe(false);
      expect(res.body.data.some((e: any) => e.id === emp2DeptA.id)).toBe(false);
    });

    it('filters /employees by status=overdue', async () => {
      const res = await request(app)
        .get(`/employees?status=overdue`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.some((e: any) => e.id === emp3DeptA.id)).toBe(true);
      expect(res.body.data.some((e: any) => e.id === emp1DeptA.id)).toBe(false);
    });

    it('combines search, departmentId, and status filters with AND intersection', async () => {
      // Search "Alice" in Department A with status "not_started" -> MATCH
      const matchRes = await request(app)
        .get(`/employees?search=Alice&departmentId=${fixture.departmentA.id}&status=not_started`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(matchRes.status).toBe(200);
      expect(matchRes.body.data.length).toBe(1);
      expect(matchRes.body.data[0].id).toBe(emp1DeptA.id);

      // Search "Alice" in Department B (wrong dept) -> NO MATCH
      const wrongDeptRes = await request(app)
        .get(`/employees?search=Alice&departmentId=${fixture.departmentB.id}&status=not_started`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(wrongDeptRes.status).toBe(200);
      expect(wrongDeptRes.body.data).toHaveLength(0);

      // Search "Alice" in Department A with status "complete" (wrong status) -> NO MATCH
      const wrongStatusRes = await request(app)
        .get(`/employees?search=Alice&departmentId=${fixture.departmentA.id}&status=complete`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(wrongStatusRes.status).toBe(200);
      expect(wrongStatusRes.body.data).toHaveLength(0);
    });

    it('filters /templates by departmentId', async () => {
      const res = await request(app)
        .get(`/templates?departmentId=${fixture.departmentA.id}`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.every((t: any) => t.departmentId === fixture.departmentA.id)).toBe(true);
      expect(res.body.data.some((t: any) => t.id === template1.id)).toBe(true);
      expect(res.body.data.some((t: any) => t.id === template2.id)).toBe(false);
    });
  });
});
