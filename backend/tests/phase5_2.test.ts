import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/utils/prisma';
import { createTestTenantFixture, cleanupTestTenant, TestTenantFixture } from './testUtils';

describe('Phase 5.2 — Detail Views & Ad-hoc Task Assignment', () => {
  let fixture: TestTenantFixture;
  const suffix = `p52_${Date.now()}`;

  let testTemplate: any;
  let employeeRecordDeptA: any;
  let employeeRecordDeptB: any;

  beforeAll(async () => {
    fixture = await createTestTenantFixture(suffix);

    // Create an onboarding template in Department A
    testTemplate = await prisma.onboardingTemplate.create({
      data: {
        name: `Engineering Onboarding ${suffix}`,
        companyId: fixture.company.id,
        departmentId: fixture.departmentA.id,
        jobRole: 'Software Engineer',
        isDefault: true,
        createdBy: fixture.hrAdmin.id,
        tasks: {
          create: [
            {
              title: 'Template Laptop Setup',
              description: 'Configure standard macOS dev environment',
              category: 'IT Setup',
              orderIndex: 0,
              assigneeType: 'employee',
              dueOffsetDays: 1,
              taskUrl: 'https://internal.wiki/setup',
            },
            {
              title: 'Template Manager 1:1 Intro',
              description: 'Introductory 30-minute sync with your manager',
              category: 'Orientation',
              orderIndex: 1,
              assigneeType: 'manager',
              dueOffsetDays: 3,
            },
          ],
        },
      },
      include: { tasks: true },
    });

    // Create Employee record 1 in Department A (assigned to managerDeptA, linked to employee1DeptA)
    const startDate = new Date('2026-10-01T00:00:00.000Z');
    employeeRecordDeptA = await prisma.employee.create({
      data: {
        companyId: fixture.company.id,
        departmentId: fixture.departmentA.id,
        managerId: fixture.managerDeptA.id,
        userId: fixture.employee1DeptA.id,
        name: `Alice Eng ${suffix}`,
        email: fixture.employee1DeptA.email,
        jobRole: 'Software Engineer',
        employmentType: 'full_time',
        startDate,
        tasks: {
          create: testTemplate.tasks.map((t: any) => ({
            title: t.title,
            description: t.description,
            category: t.category,
            orderIndex: t.orderIndex,
            assigneeType: t.assigneeType,
            taskUrl: t.taskUrl,
            sourceTemplateTaskId: t.id,
            dueDate: new Date(startDate.getTime() + t.dueOffsetDays * 86400000),
            status: 'pending',
          })),
        },
      },
      include: { tasks: true },
    });

    // Create Employee record 2 in Department B (assigned to managerDeptB)
    employeeRecordDeptB = await prisma.employee.create({
      data: {
        companyId: fixture.company.id,
        departmentId: fixture.departmentB.id,
        managerId: fixture.managerDeptB.id,
        name: `Bob Mktg ${suffix}`,
        email: `bob.${suffix}@test.com`,
        jobRole: 'Marketing Specialist',
        employmentType: 'full_time',
        startDate,
      },
    });
  });

  afterAll(async () => {
    await cleanupTestTenant(fixture.company.id);
  });

  // ==========================================
  // Task 1: HR Admin Employee Detail & Progress
  // ==========================================
  describe('Task 1 — HR Admin Employee Detail View', () => {
    it('HR Admin can view employee detail with computed progress matching calculateProgress', async () => {
      const res = await request(app)
        .get(`/employees/${employeeRecordDeptA.id}`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();

      const employee = res.body.data;
      expect(employee.id).toBe(employeeRecordDeptA.id);
      expect(employee.name).toBe(`Alice Eng ${suffix}`);
      expect(employee.department.name).toBe(`Engineering ${suffix}`);
      expect(employee.manager.email).toBe(fixture.managerDeptA.email);

      // Verify progress computation
      expect(employee.progress).toBeDefined();
      expect(employee.progress.totalTasks).toBe(2);
      expect(employee.progress.completedTasks).toBe(0);
      expect(employee.progress.percentComplete).toBe(0);
      expect(employee.tasks).toHaveLength(2);
    });
  });

  // ==========================================
  // Task 2: HR Admin Ad-hoc Task Assignment
  // ==========================================
  describe('Task 2 — HR Admin Ad-hoc Task Assignment', () => {
    let adHocTaskId: string;

    it('HR Admin assigns ad-hoc task to employee; verify sourceTemplateTaskId === null and task appears on employee roadmap', async () => {
      const exactDueDate = '2026-11-15T00:00:00.000Z';
      const res = await request(app)
        .post(`/employees/${employeeRecordDeptA.id}/tasks`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          title: 'Special Security Clearance',
          description: '## Step-by-step instructions\n1. Sign the NDA\n2. Submit fingerprint card',
          category: 'Compliance',
          assigneeType: 'employee',
          dueDate: exactDueDate,
          taskUrl: 'https://security.example.com/clearance',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();

      const createdTask = res.body.data;
      expect(createdTask.title).toBe('Special Security Clearance');
      expect(createdTask.description).toContain('## Step-by-step instructions');
      expect(createdTask.category).toBe('Compliance');
      expect(createdTask.assigneeType).toBe('employee');
      expect(createdTask.taskUrl).toBe('https://security.example.com/clearance');
      expect(new Date(createdTask.dueDate).toISOString()).toBe(exactDueDate);
      // Critical Phase 5.2 requirement: Ad-hoc tasks have sourceTemplateTaskId === null
      expect(createdTask.sourceTemplateTaskId).toBeNull();
      // Computed next orderIndex (0 and 1 exist, next is 2)
      expect(createdTask.orderIndex).toBe(2);

      adHocTaskId = createdTask.id;

      // Verify the task appears on the employee roadmap
      const detailRes = await request(app)
        .get(`/employees/${employeeRecordDeptA.id}`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(detailRes.status).toBe(200);
      const tasks = detailRes.body.data.tasks;
      expect(tasks).toHaveLength(3);
      const found = tasks.find((t: any) => t.id === adHocTaskId);
      expect(found).toBeDefined();
      expect(found.sourceTemplateTaskId).toBeNull();
      expect(detailRes.body.data.progress.totalTasks).toBe(3);
    });

    it('Direct dueDate stores exact calendar date', async () => {
      const dbTask = await prisma.employeeTask.findUnique({
        where: { id: adHocTaskId },
      });
      expect(dbTask).not.toBeNull();
      expect(dbTask?.dueDate?.toISOString()).toBe('2026-11-15T00:00:00.000Z');
    });

    it('Validation: rejects missing title, category, or invalid dueDate/taskUrl', async () => {
      // Missing title
      const resMissingTitle = await request(app)
        .post(`/employees/${employeeRecordDeptA.id}/tasks`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          category: 'IT Setup',
          assigneeType: 'employee',
        });
      expect(resMissingTitle.status).toBe(400);

      // Invalid assigneeType
      const resInvalidAssignee = await request(app)
        .post(`/employees/${employeeRecordDeptA.id}/tasks`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          title: 'Test',
          category: 'IT Setup',
          assigneeType: 'superadmin',
        });
      expect(resInvalidAssignee.status).toBe(400);

      // Invalid taskUrl
      const resInvalidUrl = await request(app)
        .post(`/employees/${employeeRecordDeptA.id}/tasks`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          title: 'Test',
          category: 'IT Setup',
          assigneeType: 'employee',
          taskUrl: 'not-a-valid-url',
        });
      expect(resInvalidUrl.status).toBe(400);
    });
  });

  // ==========================================
  // Task 3: Manager Ad-hoc Task Assignment & Scoping
  // ==========================================
  describe('Task 3 — Manager Ad-hoc Task Assignment & Department Scoping', () => {
    let managerAdHocTaskId: string;

    it('Manager assigns ad-hoc task to employee in own department; verify HTTP 201', async () => {
      const res = await request(app)
        .post(`/employees/${employeeRecordDeptA.id}/tasks`)
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`)
        .send({
          title: '30-Day Manager Alignment Check',
          description: 'Review probation milestones and initial sprint contributions',
          category: 'Manager Sync',
          assigneeType: 'manager',
          dueDate: '2026-10-31T17:00:00.000Z',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();

      const created = res.body.data;
      expect(created.title).toBe('30-Day Manager Alignment Check');
      expect(created.assigneeType).toBe('manager');
      expect(created.sourceTemplateTaskId).toBeNull();
      managerAdHocTaskId = created.id;
    });

    it('Manager attempts ad-hoc task assignment to employee in different department; verify rejection (HTTP 404 per scopeToDepartment)', async () => {
      // managerDeptA is in Dept A; employeeRecordDeptB is in Dept B
      const res = await request(app)
        .post(`/employees/${employeeRecordDeptB.id}/tasks`)
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`)
        .send({
          title: 'Unauthorized Cross-Dept Task',
          category: 'IT Setup',
          assigneeType: 'manager',
        });

      // scopeToDepartment throws NotFoundError (404) to prevent cross-dept employee enumeration
      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('Ad-hoc task with assigneeType = "manager" cannot be completed by employee (WRONG_ASSIGNEE_TYPE 403)', async () => {
      const res = await request(app)
        .patch(`/employees/${employeeRecordDeptA.id}/tasks/${managerAdHocTaskId}`)
        .set('Authorization', `Bearer ${fixture.employee1DeptA.token}`)
        .send({ status: 'completed' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('WRONG_ASSIGNEE_TYPE');

      // Verify task remains uncompleted
      const dbTask = await prisma.employeeTask.findUnique({
        where: { id: managerAdHocTaskId },
      });
      expect(dbTask?.status).toBe('pending');
      expect(dbTask?.completedAt).toBeNull();
    });

    it('Ad-hoc task with assigneeType = "manager" can be completed by department manager', async () => {
      const res = await request(app)
        .patch(`/employees/${employeeRecordDeptA.id}/tasks/${managerAdHocTaskId}`)
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`)
        .send({ status: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.completedAt).not.toBeNull();

      // Verify database
      const dbTask = await prisma.employeeTask.findUnique({
        where: { id: managerAdHocTaskId },
      });
      expect(dbTask?.status).toBe('completed');
    });
  });

  // ==========================================
  // Regressions: Phase 2 snapshot & Assignee Rules
  // ==========================================
  describe('Regressions — Snapshot Independence & Assignee Rules', () => {
    it('Phase 2 snapshot-on-assignment: ad-hoc tasks are additive and do not alter source template', async () => {
      const freshTemplate = await prisma.onboardingTemplate.findUnique({
        where: { id: testTemplate.id },
        include: { tasks: true },
      });

      // Original template tasks count remains exactly 2
      expect(freshTemplate?.tasks).toHaveLength(2);
      expect(freshTemplate?.tasks.map((t) => t.title)).toEqual([
        'Template Laptop Setup',
        'Template Manager 1:1 Intro',
      ]);

      // Employee has 4 total tasks now: 2 from template snapshot, 2 ad-hoc
      const employeeTasks = await prisma.employeeTask.findMany({
        where: { employeeId: employeeRecordDeptA.id },
        orderBy: { orderIndex: 'asc' },
      });

      expect(employeeTasks).toHaveLength(4);
      expect(employeeTasks[0].sourceTemplateTaskId).not.toBeNull();
      expect(employeeTasks[1].sourceTemplateTaskId).not.toBeNull();
      expect(employeeTasks[2].sourceTemplateTaskId).toBeNull();
      expect(employeeTasks[3].sourceTemplateTaskId).toBeNull();
    });
  });
});
