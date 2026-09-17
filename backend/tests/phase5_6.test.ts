import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/utils/prisma';
import { createTestTenantFixture, cleanupTestTenant, TestTenantFixture } from './testUtils';
import groqService, { FALLBACK_ERROR_MESSAGE } from '../src/services/groqService';
import { signAccessToken } from '../src/utils/token';
import jwt from 'jsonwebtoken';

describe('Phase 5.6 — Analytics & Polish Tests', () => {
  let fixture: TestTenantFixture;
  const suffix = `p56_${Date.now()}`;

  // Deterministic employee references
  let emp1EngId: string;
  let emp2EngId: string;
  let emp3MktgId: string;

  beforeAll(async () => {
    fixture = await createTestTenantFixture(suffix);

    // Create a template for Engineering
    const engTemplate = await prisma.onboardingTemplate.create({
      data: {
        name: `Engineering Onboarding ${suffix}`,
        companyId: fixture.company.id,
        departmentId: fixture.departmentA.id,
        isDefault: true,
        createdBy: fixture.hrAdmin.id,
        tasks: {
          create: [
            {
              title: 'Setup Development Environment',
              category: 'IT Setup',
              orderIndex: 0,
              assigneeType: 'employee',
              dueOffsetDays: 3,
            },
            {
              title: 'Review Architecture Docs',
              category: 'Engineering',
              orderIndex: 1,
              assigneeType: 'employee',
              dueOffsetDays: 5,
            },
          ],
        },
      },
      include: { tasks: true },
    });

    const [tmplTask1, tmplTask2] = engTemplate.tasks;

    // Create a template for Marketing
    const mktgTemplate = await prisma.onboardingTemplate.create({
      data: {
        name: `Marketing Onboarding ${suffix}`,
        companyId: fixture.company.id,
        departmentId: fixture.departmentB.id,
        isDefault: true,
        createdBy: fixture.hrAdmin.id,
        tasks: {
          create: [
            {
              title: 'Setup Brand Assets',
              category: 'Branding',
              orderIndex: 0,
              assigneeType: 'employee',
              dueOffsetDays: 2,
            },
            {
              title: 'Review Campaign Strategy',
              category: 'Campaigns',
              orderIndex: 1,
              assigneeType: 'employee',
              dueOffsetDays: 4,
            },
          ],
        },
      },
      include: { tasks: true },
    });

    const [mktgTask1, mktgTask2] = mktgTemplate.tasks;

    const DAY_MS = 86400000;
    const now = Date.now();

    // 1. Employee 1 (Engineering): Created 10 days ago
    // Tasks:
    // - Task 1 (tmpl): Completed at creation + 2 days (duration = 2.0 days)
    // - Task 2 (tmpl): Completed at creation + 4 days (duration = 4.0 days)
    // - Task 3 (ad-hoc): Completed at creation + 6 days (duration = 6.0 days)
    // - Task 4 (ad-hoc): Pending, due 2 days ago (OVERDUE!)
    const emp1CreatedAt = new Date(now - 10 * DAY_MS);
    const emp1 = await prisma.employee.create({
      data: {
        name: `Engineer One ${suffix}`,
        email: `eng1.${suffix}@test.com`,
        userId: fixture.employee1DeptA.id,
        companyId: fixture.company.id,
        departmentId: fixture.departmentA.id,
        jobRole: 'Software Engineer',
        employmentType: 'full_time',
        startDate: emp1CreatedAt,
        createdAt: emp1CreatedAt,
        tasks: {
          create: [
            {
              title: tmplTask1.title,
              category: tmplTask1.category,
              orderIndex: 0,
              assigneeType: tmplTask1.assigneeType,
              status: 'completed',
              completedAt: new Date(emp1CreatedAt.getTime() + 2 * DAY_MS),
              sourceTemplateTaskId: tmplTask1.id,
            },
            {
              title: tmplTask2.title,
              category: tmplTask2.category,
              orderIndex: 1,
              assigneeType: tmplTask2.assigneeType,
              status: 'completed',
              completedAt: new Date(emp1CreatedAt.getTime() + 4 * DAY_MS),
              sourceTemplateTaskId: tmplTask2.id,
            },
            {
              title: 'Ad-hoc Codebase Tour',
              category: 'Engineering',
              orderIndex: 2,
              assigneeType: 'employee',
              status: 'completed',
              completedAt: new Date(emp1CreatedAt.getTime() + 6 * DAY_MS),
              sourceTemplateTaskId: null, // ad-hoc!
            },
            {
              title: 'Ad-hoc Security Quiz',
              category: 'Security',
              orderIndex: 3,
              assigneeType: 'employee',
              status: 'pending',
              dueDate: new Date(now - 2 * DAY_MS), // overdue!
              sourceTemplateTaskId: null, // ad-hoc!
            },
          ],
        },
      },
    });
    emp1EngId = emp1.id;

    // 2. Employee 2 (Engineering): Created 5 days ago
    // Tasks:
    // - Task 1 (tmpl): Pending, due in 3 days (not overdue)
    // - Task 2 (ad-hoc): Completed at creation + 1 day (duration = 1.0 days)
    const emp2CreatedAt = new Date(now - 5 * DAY_MS);
    const emp2 = await prisma.employee.create({
      data: {
        name: `Engineer Two ${suffix}`,
        email: `eng2.${suffix}@test.com`,
        companyId: fixture.company.id,
        departmentId: fixture.departmentA.id,
        jobRole: 'Frontend Engineer',
        employmentType: 'full_time',
        startDate: emp2CreatedAt,
        createdAt: emp2CreatedAt,
        tasks: {
          create: [
            {
              title: tmplTask1.title,
              category: tmplTask1.category,
              orderIndex: 0,
              assigneeType: tmplTask1.assigneeType,
              status: 'pending',
              dueDate: new Date(now + 3 * DAY_MS),
              sourceTemplateTaskId: tmplTask1.id,
            },
            {
              title: 'Ad-hoc Slack Setup',
              category: 'IT Setup',
              orderIndex: 1,
              assigneeType: 'employee',
              status: 'completed',
              completedAt: new Date(emp2CreatedAt.getTime() + 1 * DAY_MS),
              sourceTemplateTaskId: null, // ad-hoc!
            },
          ],
        },
      },
    });
    emp2EngId = emp2.id;

    // 3. Employee 3 (Marketing): Created 8 days ago
    // Tasks:
    // - Task 1 (tmpl): Completed at creation + 5 days (duration = 5.0 days)
    // - Task 2 (tmpl): Pending, due 1 day ago (OVERDUE!)
    const emp3CreatedAt = new Date(now - 8 * DAY_MS);
    const emp3 = await prisma.employee.create({
      data: {
        name: `Marketer One ${suffix}`,
        email: `mktg1.${suffix}@test.com`,
        companyId: fixture.company.id,
        departmentId: fixture.departmentB.id,
        jobRole: 'Marketing Specialist',
        employmentType: 'full_time',
        startDate: emp3CreatedAt,
        createdAt: emp3CreatedAt,
        tasks: {
          create: [
            {
              title: mktgTask1.title,
              category: mktgTask1.category,
              orderIndex: 0,
              assigneeType: mktgTask1.assigneeType,
              status: 'completed',
              completedAt: new Date(emp3CreatedAt.getTime() + 5 * DAY_MS),
              sourceTemplateTaskId: mktgTask1.id,
            },
            {
              title: mktgTask2.title,
              category: mktgTask2.category,
              orderIndex: 1,
              assigneeType: mktgTask2.assigneeType,
              status: 'pending',
              dueDate: new Date(now - 1 * DAY_MS), // overdue!
              sourceTemplateTaskId: mktgTask2.id,
            },
          ],
        },
      },
    });
    emp3MktgId = emp3.id;
  });

  afterAll(async () => {
    await cleanupTestTenant(fixture.company.id);
  });

  // ==========================================
  // TASK 1: Core Analytics Calculations
  // ==========================================

  it('calculates deterministic % completion, overdue counts, and average time-to-complete correctly for HR Admin', async () => {
    const res = await request(app)
      .get('/analytics')
      .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');

    const { summary, departments, templates } = res.body.data;

    // Expected numbers:
    // Total employees = 3
    expect(summary.totalEmployees).toBe(3);

    // Total tasks = 4 (emp1) + 2 (emp2) + 2 (emp3) = 8
    expect(summary.totalTasks).toBe(8);

    // Completed tasks = 3 (emp1) + 1 (emp2) + 1 (emp3) = 5
    expect(summary.completedTasks).toBe(5);

    // Overdue tasks = 1 (emp1) + 0 (emp2) + 1 (emp3) = 2
    expect(summary.overdueTasks).toBe(2);

    // Overall completion rate = Math.round(5 / 8 * 100) = 63%
    expect(summary.overallCompletionRate).toBe(63);

    // Average time to complete = (2 + 4 + 6 + 1 + 5) / 5 = 3.6 days
    expect(summary.averageTimeToCompleteDays).toBe(3.6);

    // Department rollups assertion
    expect(departments.length).toBe(2);

    const engDept = departments.find((d: any) => d.departmentId === fixture.departmentA.id);
    expect(engDept).toBeDefined();
    expect(engDept.employeeCount).toBe(2);
    expect(engDept.totalTasks).toBe(6);
    expect(engDept.completedTasks).toBe(4);
    expect(engDept.overdueTasks).toBe(1);
    // Eng average time = (2 + 4 + 6 + 1) / 4 = 3.3 days (or 3.25 rounded to 3.3)
    expect(engDept.averageTimeToCompleteDays).toBe(3.3);

    const mktgDept = departments.find((d: any) => d.departmentId === fixture.departmentB.id);
    expect(mktgDept).toBeDefined();
    expect(mktgDept.employeeCount).toBe(1);
    expect(mktgDept.totalTasks).toBe(2);
    expect(mktgDept.completedTasks).toBe(1);
    expect(mktgDept.overdueTasks).toBe(1);
    expect(mktgDept.averageTimeToCompleteDays).toBe(5.0);
  });

  it('confirms ad-hoc tasks are included in calculations (excluding them produces an incorrect result)', async () => {
    const res = await request(app)
      .get('/analytics')
      .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

    expect(res.status).toBe(200);
    const { summary } = res.body.data;

    // If ad-hoc tasks were excluded:
    // - Total tasks would be 5 (only template tasks), NOT 8.
    // - Completed tasks would be 3, NOT 5.
    // - Overdue tasks would be 1, NOT 2.
    expect(summary.totalTasks).not.toBe(5);
    expect(summary.completedTasks).not.toBe(3);
    expect(summary.overdueTasks).not.toBe(1);

    expect(summary.totalTasks).toBe(8);
    expect(summary.completedTasks).toBe(5);
    expect(summary.overdueTasks).toBe(2);
  });

  it('scopes Manager analytics strictly to their own department', async () => {
    // Manager of Department A (Engineering)
    const res = await request(app)
      .get('/analytics')
      .set('Authorization', `Bearer ${fixture.managerDeptA.token}`);

    expect(res.status).toBe(200);
    const { summary, departments } = res.body.data;

    // Engineering has 2 employees, 6 tasks, 4 completed, 1 overdue
    expect(summary.totalEmployees).toBe(2);
    expect(summary.totalTasks).toBe(6);
    expect(summary.completedTasks).toBe(4);
    expect(summary.overdueTasks).toBe(1);

    // Departments list contains only Engineering
    expect(departments.length).toBe(1);
    expect(departments[0].departmentId).toBe(fixture.departmentA.id);
  });

  it('rejects Manager attempt to access analytics for another department with 403', async () => {
    // Manager Dept A attempts to query Department B
    const res = await request(app)
      .get(`/analytics?departmentId=${fixture.departmentB.id}`)
      .set('Authorization', `Bearer ${fixture.managerDeptA.token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows HR Admin to filter analytics by a specific department', async () => {
    const res = await request(app)
      .get(`/analytics?departmentId=${fixture.departmentB.id}`)
      .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

    expect(res.status).toBe(200);
    const { summary, departments } = res.body.data;

    expect(summary.totalEmployees).toBe(1);
    expect(summary.totalTasks).toBe(2);
    expect(departments.length).toBe(1);
    expect(departments[0].departmentId).toBe(fixture.departmentB.id);
  });

  it('rejects Employee role attempting to access analytics with 403', async () => {
    const res = await request(app)
      .get('/analytics')
      .set('Authorization', `Bearer ${fixture.employee1DeptA.token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // ==========================================
  // TASK 3: Deliberate Failure-Mode Audit Tests
  // ==========================================

  // Failure Mode 1: Corrupted / unsupported file upload to Knowledge Base (Phase 3)
  it('Failure Mode 1: rejects corrupted or unsupported file to Knowledge Base with 400', async () => {
    const res = await request(app)
      .post('/documents')
      .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
      .attach('file', Buffer.from('executable binary header \x7fELF'), 'malicious.pdf');

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  // Failure Mode 2: Corrupted / unsupported file upload to Document Library (Phase 5.4)
  it('Failure Mode 2: rejects unsupported file to Document Library with 400', async () => {
    const res = await request(app)
      .post('/library-documents')
      .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
      .attach('file', Buffer.from('script payload'), 'script.sh');

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  // Failure Mode 3: Expired access token handling
  it('Failure Mode 3: rejects an expired access token with 401', async () => {
    const expiredToken = jwt.sign(
      {
        userId: fixture.hrAdmin.id,
        email: fixture.hrAdmin.email,
        role: 'hr_admin',
        companyId: fixture.company.id,
      },
      process.env.JWT_ACCESS_SECRET || 'test-access-secret',
      { expiresIn: '-1s' } // Expired 1 second ago
    );

    const res = await request(app)
      .get('/analytics')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  // Failure Mode 4: Groq timeout or rate-limit response fallback to Qorra
  it('Failure Mode 4: returns graceful fallback message when Groq throws an error or times out', async () => {
    const groqClientMock = {
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(new Error('Groq rate limit 429: Too Many Requests')),
        },
      },
    };
    const getClientSpy = vi
      .spyOn(groqService as any, 'getClient')
      .mockReturnValue(groqClientMock);

    try {
      const result = await groqService.generateAnswer('What is the vacation policy?', [
        { documentId: 'doc-1', documentFilename: 'policy.pdf', content: 'Vacation days: 20' },
      ]);

      expect(result.isFallback).toBe(true);
      expect(result.answer).toBe(FALLBACK_ERROR_MESSAGE);
    } finally {
      getClientSpy.mockRestore();
    }
  });

  // Failure Mode 5: Template with zero tasks assigned to employee
  it('Failure Mode 5: creates employee successfully when assigned template has zero tasks', async () => {
    const emptyTemplate = await prisma.onboardingTemplate.create({
      data: {
        name: `Zero Task Template ${suffix}`,
        companyId: fixture.company.id,
        departmentId: fixture.departmentA.id,
        isDefault: false,
        createdBy: fixture.hrAdmin.id,
      },
    });

    const res = await request(app)
      .post('/employees')
      .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
      .send({
        name: `Zero Task Emp ${suffix}`,
        email: `zerotask.${suffix}@test.com`,
        departmentId: fixture.departmentA.id,
        jobRole: 'Specialist',
        employmentType: 'full_time',
        startDate: '2026-10-01',
        templateId: emptyTemplate.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.tasks.length).toBe(0);
    expect(res.body.data.progress.totalTasks).toBe(0);
    expect(res.body.data.progress.percentComplete).toBe(0);
  });

  // Failure Mode 6: Employee role/dept with no matching template falls back to department default
  it('Failure Mode 6: falls back to department default template when no exact role match exists', async () => {
    const res = await request(app)
      .post('/employees')
      .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
      .send({
        name: `Fallback Emp ${suffix}`,
        email: `fallback.${suffix}@test.com`,
        departmentId: fixture.departmentA.id,
        jobRole: 'Unknown Rare Role With No Template',
        employmentType: 'full_time',
        startDate: '2026-10-01',
      });

    expect(res.status).toBe(201);
    // Should have snapshotted tasks from Engineering default template
    expect(res.body.data.tasks.length).toBeGreaterThan(0);
  });

  // Failure Mode 7: Malformed / non-YouTube URL for training entry
  it('Failure Mode 7: rejects malformed or non-YouTube URL when creating a training entry with 400', async () => {
    const res = await request(app)
      .post('/training')
      .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
      .send({
        title: 'Invalid Video Entry',
        description: 'Testing failure mode',
        contentType: 'video',
        youtubeUrl: 'https://vimeo.com/12345678',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // Failure Mode 8: Ad-hoc task assignment to employee outside assigner scope
  it('Failure Mode 8: rejects Manager attempting ad-hoc task assignment to employee in another department (404 per anti-enumeration)', async () => {
    // Manager of Dept A attempts to assign ad-hoc task to Employee in Dept B (Marketing)
    // Per security.md Section 9, scopeToDepartment returns 404 to prevent cross-department enumeration
    const res = await request(app)
      .post(`/employees/${emp3MktgId}/tasks`)
      .set('Authorization', `Bearer ${fixture.managerDeptA.token}`)
      .send({
        title: 'Cross-Dept Task',
        category: 'General',
        assigneeType: 'employee',
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');

    // And verify Employee role attempting ad-hoc assignment is rejected with 403 Forbidden
    const empRes = await request(app)
      .post(`/employees/${emp1EngId}/tasks`)
      .set('Authorization', `Bearer ${fixture.employee1DeptA.token}`)
      .send({
        title: 'Unauthorized Employee Task',
        category: 'General',
        assigneeType: 'employee',
      });

    expect(empRes.status).toBe(403);
    expect(empRes.body.error.code).toBe('FORBIDDEN');
  });

  // Failure Mode 9: Attempt to delete department that still has dependents
  it('Failure Mode 9: rejects deleting a department that still has assigned employees with 400', async () => {
    const res = await request(app)
      .delete(`/departments/${fixture.departmentA.id}`)
      .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Cannot delete department');
  });

  // Failure Mode 10: Delete library document referenced by task
  it('Failure Mode 10: sets task relatedDocumentId to null when referenced library document is deleted', async () => {
    // 1. Upload a library document
    const doc = await prisma.libraryDocument.create({
      data: {
        companyId: fixture.company.id,
        departmentId: null,
        filename: `handbook_${suffix}.pdf`,
        storagePath: `uploads/handbook_${suffix}.pdf`,
        uploadedBy: fixture.hrAdmin.id,
        status: 'ready',
      },
    });

    // 2. Assign ad-hoc task linking to this document
    const task = await prisma.employeeTask.create({
      data: {
        employeeId: emp1EngId,
        title: `Read Policy Doc ${suffix}`,
        category: 'Policy',
        orderIndex: 10,
        assigneeType: 'employee',
        status: 'pending',
        relatedDocumentId: doc.id,
      },
    });

    expect(task.relatedDocumentId).toBe(doc.id);

    // 3. Delete the library document
    await prisma.libraryDocument.delete({
      where: { id: doc.id },
    });

    // 4. Query the task again: Postgres onDelete: SetNull should have cleared relatedDocumentId
    const updatedTask = await prisma.employeeTask.findUnique({
      where: { id: task.id },
    });

    expect(updatedTask?.relatedDocumentId).toBeNull();
  });

  // Failure Mode 11: Oversized page size clamping
  it('Failure Mode 11: clamps oversized limit query parameters to maximum 100', async () => {
    const res = await request(app)
      .get('/employees?limit=5000')
      .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(100);
  });

  // Failure Mode 12: Attempt to complete task with wrong assignee type
  it('Failure Mode 12: rejects completing a task with the wrong assignee type with 403 WRONG_ASSIGNEE_TYPE', async () => {
    // Create a manager-assigned task for emp1
    const mgrTask = await prisma.employeeTask.create({
      data: {
        employeeId: emp1EngId,
        title: `Manager Approval Step ${suffix}`,
        category: 'HR Paperwork',
        orderIndex: 20,
        assigneeType: 'manager',
        status: 'pending',
      },
    });

    // Employee 1 attempts to toggle this manager task complete
    const res = await request(app)
      .patch(`/employees/${emp1EngId}/tasks/${mgrTask.id}`)
      .set('Authorization', `Bearer ${fixture.employee1DeptA.token}`)
      .send({
        status: 'completed',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WRONG_ASSIGNEE_TYPE');
  });
});
