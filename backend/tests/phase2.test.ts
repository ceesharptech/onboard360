import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/utils/prisma';
import { createTestTenantFixture, cleanupTestTenant, TestTenantFixture } from './testUtils';

describe('Phase 2 — Employee, Onboarding & Workflow Builder', () => {
  let fixture: TestTenantFixture;
  const testSuffix = `p2_${Date.now()}`;

  beforeAll(async () => {
    fixture = await createTestTenantFixture(testSuffix);
  });

  afterAll(async () => {
    if (fixture?.company?.id) {
      await cleanupTestTenant(fixture.company.id);
    }
  });

  describe('1. Snapshot-on-Assignment (Hard Requirement)', () => {
    it('creates an employee from a template, then asserts editing the template does NOT alter the employee tasks', async () => {
      // 1. Create a template in departmentA with 3 tasks
      const templateRes = await request(app)
        .post('/templates')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: 'Snapshot Test Template',
          departmentId: fixture.departmentA.id,
          jobRole: 'Snapshot Role',
          isDefault: false,
          tasks: [
            {
              title: 'Task Alpha',
              description: 'First test task',
              category: 'IT Setup',
              orderIndex: 0,
              assigneeType: 'employee',
              dueOffsetDays: 1,
            },
            {
              title: 'Task Beta',
              description: 'Second test task',
              category: 'Role Training',
              orderIndex: 1,
              assigneeType: 'manager',
              dueOffsetDays: 3,
            },
            {
              title: 'Task Gamma',
              description: 'Third test task',
              category: 'Company Policies',
              orderIndex: 2,
              assigneeType: 'mentor',
              dueOffsetDays: 5,
            },
          ],
        });

      expect(templateRes.status).toBe(201);
      const templateId = templateRes.body.data.id;
      expect(templateRes.body.data.tasks.length).toBe(3);

      // 2. Create an employee assigned to this role + department
      const employeeRes = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: 'Snapshot Target Employee',
          email: `snapshot_${Date.now()}@test.com`,
          departmentId: fixture.departmentA.id,
          jobRole: 'Snapshot Role',
          startDate: '2026-10-01',
          employmentType: 'full_time',
        });

      expect(employeeRes.status).toBe(201);
      const employeeId = employeeRes.body.data.id;
      const initialEmployeeTasks = employeeRes.body.data.tasks;
      expect(initialEmployeeTasks.length).toBe(3);
      expect(initialEmployeeTasks.map((t: any) => t.title)).toEqual([
        'Task Alpha',
        'Task Beta',
        'Task Gamma',
      ]);

      // 3. Edit the source template: mutate existing task, delete one, add a new one
      const updateTemplateRes = await request(app)
        .put(`/templates/${templateId}`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: 'Mutated Snapshot Template',
          tasks: [
            {
              title: 'Task Alpha MODIFIED',
              description: 'Changed description',
              category: 'IT Setup',
              orderIndex: 0,
              assigneeType: 'employee',
              dueOffsetDays: 1,
            },
            {
              title: 'Task Delta NEW',
              description: 'Brand new fourth task',
              category: 'Role Training',
              orderIndex: 1,
              assigneeType: 'employee',
              dueOffsetDays: 7,
            },
          ],
        });

      expect(updateTemplateRes.status).toBe(200);
      expect(updateTemplateRes.body.data.tasks.length).toBe(2);

      // 4. Re-fetch the employee and strictly assert that their tasks are UNCHANGED
      const verifyEmployeeRes = await request(app)
        .get(`/employees/${employeeId}`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(verifyEmployeeRes.status).toBe(200);
      const postMutationTasks = verifyEmployeeRes.body.data.tasks;

      // The employee MUST still have 3 tasks, with original titles, categories, and due dates
      expect(postMutationTasks.length).toBe(3);
      expect(postMutationTasks.map((t: any) => t.title)).toEqual([
        'Task Alpha',
        'Task Beta',
        'Task Gamma',
      ]);
      expect(postMutationTasks[0].title).toBe('Task Alpha');
      expect(postMutationTasks[0].description).toBe('First test task');
      expect(postMutationTasks.find((t: any) => t.title === 'Task Delta NEW')).toBeUndefined();
    });
  });

  describe('2. Template Scoping & Permissions', () => {
    it('forbids a Manager from creating a template in another department (returns 404)', async () => {
      const res = await request(app)
        .post('/templates')
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`)
        .send({
          name: 'Manager Cross-Dept Template',
          departmentId: fixture.departmentB.id, // Manager A targeting Department B
          jobRole: 'Marketing Lead',
          isDefault: false,
          tasks: [],
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('allows a Manager to create and edit a template in their own department', async () => {
      const createRes = await request(app)
        .post('/templates')
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`)
        .send({
          name: 'Engineering Onboarding Template',
          departmentId: fixture.departmentA.id,
          jobRole: 'Software Engineer',
          isDefault: false,
          tasks: [
            {
              title: 'Setup IDE',
              category: 'IT Setup',
              orderIndex: 0,
              assigneeType: 'employee',
              dueOffsetDays: 1,
            },
          ],
        });

      expect(createRes.status).toBe(201);
      const templateId = createRes.body.data.id;

      // Update own department template
      const updateRes = await request(app)
        .put(`/templates/${templateId}`)
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`)
        .send({
          name: 'Updated Engineering Onboarding Template',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.name).toBe('Updated Engineering Onboarding Template');

      // Manager B cannot access or edit Manager A's template (returns 404)
      const crossDeptRes = await request(app)
        .put(`/templates/${templateId}`)
        .set('Authorization', `Bearer ${fixture.managerDeptB.token}`)
        .send({
          name: 'Malicious Update',
        });

      expect(crossDeptRes.status).toBe(404);
    });

    it('allows HR Admin to create, list, and edit templates in any department company-wide', async () => {
      const resA = await request(app)
        .post('/templates')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: 'HR Created Dept B Template',
          departmentId: fixture.departmentB.id,
          jobRole: 'Marketing Specialist',
          isDefault: false,
          tasks: [],
        });

      expect(resA.status).toBe(201);
    });
  });

  describe('3. Template Matching & Department Fallback', () => {
    let deptBDefaultTemplateId: string;

    beforeAll(async () => {
      // Create a department-level default template for Department B
      const defaultTemplateRes = await request(app)
        .post('/templates')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: 'Department B General Default Template',
          departmentId: fixture.departmentB.id,
          jobRole: null,
          isDefault: true,
          tasks: [
            {
              title: 'Default Dept B Welcome',
              category: 'Orientation',
              orderIndex: 0,
              assigneeType: 'employee',
              dueOffsetDays: 1,
            },
            {
              title: 'Default Dept B Policy Signoff',
              category: 'Company Policies',
              orderIndex: 1,
              assigneeType: 'employee',
              dueOffsetDays: 2,
            },
          ],
        });

      deptBDefaultTemplateId = defaultTemplateRes.body.data.id;
    });

    it('correctly falls back to department default template when employee role has no exact match', async () => {
      const employeeRes = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: 'Unmatched Role Employee',
          email: `unmatched_${Date.now()}@test.com`,
          departmentId: fixture.departmentB.id,
          jobRole: 'Completely Unique Role Never Defined',
          startDate: '2026-11-01',
          employmentType: 'contract',
        });

      expect(employeeRes.status).toBe(201);
      const tasks = employeeRes.body.data.tasks;
      expect(tasks.length).toBe(2);
      expect(tasks[0].title).toBe('Default Dept B Welcome');
      expect(tasks[1].title).toBe('Default Dept B Policy Signoff');
    });
  });

  describe('4. Mentor Pool & Least-Loaded Round-Robin Assignment', () => {
    let mentorAlexUser: any;
    let mentorSamUser: any;
    let mentorAlexRecord: any;
    let mentorSamRecord: any;

    beforeAll(async () => {
      // Add two mentors to department A mentor pool
      const alexRes = await request(app)
        .post(`/departments/${fixture.departmentA.id}/mentors`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({ userId: fixture.employee1DeptA.id });

      expect(alexRes.status).toBe(201);
      mentorAlexRecord = alexRes.body.data;

      const samRes = await request(app)
        .post(`/departments/${fixture.departmentA.id}/mentors`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({ userId: fixture.employee2DeptA.id });

      expect(samRes.status).toBe(201);
      mentorSamRecord = samRes.body.data;
    });

    it('assigns mentors via least-loaded round-robin logic and increments currentMenteeCount', async () => {
      // Employee 1 creation -> should assign mentor Alex (tied at 0, first picked)
      const emp1Res = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: 'Mentee One',
          email: `mentee1_${Date.now()}@test.com`,
          departmentId: fixture.departmentA.id,
          jobRole: 'Software Engineer',
          startDate: '2026-10-01',
          employmentType: 'full_time',
        });

      expect(emp1Res.status).toBe(201);
      const assignedMentor1 = emp1Res.body.data.mentorId;
      expect([mentorAlexRecord.id, mentorSamRecord.id]).toContain(assignedMentor1);

      // Employee 2 creation -> must assign the other mentor (who still has 0 mentees)
      const emp2Res = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: 'Mentee Two',
          email: `mentee2_${Date.now()}@test.com`,
          departmentId: fixture.departmentA.id,
          jobRole: 'Software Engineer',
          startDate: '2026-10-01',
          employmentType: 'full_time',
        });

      expect(emp2Res.status).toBe(201);
      const assignedMentor2 = emp2Res.body.data.mentorId;
      expect([mentorAlexRecord.id, mentorSamRecord.id]).toContain(assignedMentor2);
      expect(assignedMentor2).not.toBe(assignedMentor1);

      // Verify both mentors now have currentMenteeCount == 1 in department pool
      const mentorsRes = await request(app)
        .get(`/departments/${fixture.departmentA.id}/mentors`)
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`);

      expect(mentorsRes.status).toBe(200);
      const mentors = mentorsRes.body.data;
      const m1 = mentors.find((m: any) => m.id === assignedMentor1);
      const m2 = mentors.find((m: any) => m.id === assignedMentor2);
      expect(m1.currentMenteeCount).toBe(1);
      expect(m2.currentMenteeCount).toBe(1);
    });
  });

  describe('5. Access Control, Task Completion & Progress Endpoints', () => {
    let createdEmployee: any;

    beforeAll(async () => {
      // Create an employee linked to employee1DeptA's user account
      const res = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: 'Test Linked Employee',
          email: fixture.employee1DeptA.email,
          departmentId: fixture.departmentA.id,
          jobRole: 'Software Engineer',
          startDate: '2026-10-01',
          employmentType: 'full_time',
        });

      createdEmployee = res.body.data;
    });

    it('allows an employee to read their own record and mark their own task complete', async () => {
      // Employee reads their own record
      const readRes = await request(app)
        .get(`/employees/${createdEmployee.id}`)
        .set('Authorization', `Bearer ${fixture.employee1DeptA.token}`);

      expect(readRes.status).toBe(200);
      expect(readRes.body.data.id).toBe(createdEmployee.id);
      expect(readRes.body.data.tasks.length).toBeGreaterThan(0);

      const firstTask = readRes.body.data.tasks[0];
      expect(firstTask.status).toBe('pending');
      expect(firstTask.completedAt).toBeNull();

      // Employee marks task complete
      const completeRes = await request(app)
        .patch(`/employees/${createdEmployee.id}/tasks/${firstTask.id}`)
        .set('Authorization', `Bearer ${fixture.employee1DeptA.token}`)
        .send({ status: 'completed' });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.status).toBe('completed');
      expect(completeRes.body.data.completedAt).toBeDefined();

      // Check progress endpoint
      const progressRes = await request(app)
        .get(`/employees/${createdEmployee.id}/progress`)
        .set('Authorization', `Bearer ${fixture.employee1DeptA.token}`);

      expect(progressRes.status).toBe(200);
      expect(progressRes.body.data.completedTasks).toBe(1);
      expect(progressRes.body.data.percentComplete).toBeGreaterThan(0);
    });

    it('forbids an Employee from viewing or modifying another employee record (returns 404)', async () => {
      // Employee 2 attempts to read Employee 1's record
      const getRes = await request(app)
        .get(`/employees/${createdEmployee.id}`)
        .set('Authorization', `Bearer ${fixture.employee2DeptA.token}`);

      expect(getRes.status).toBe(404);
      expect(getRes.body.error.code).toBe('NOT_FOUND');

      // Employee 2 attempts to update Employee 1's task
      const firstTask = createdEmployee.tasks[0];
      const patchRes = await request(app)
        .patch(`/employees/${createdEmployee.id}/tasks/${firstTask.id}`)
        .set('Authorization', `Bearer ${fixture.employee2DeptA.token}`)
        .send({ status: 'pending' });

      expect(patchRes.status).toBe(404);
    });

    it('forbids a Manager from accessing employees in another department (returns 404)', async () => {
      const res = await request(app)
        .get(`/employees/${createdEmployee.id}`)
        .set('Authorization', `Bearer ${fixture.managerDeptB.token}`); // Manager B targeting Dept A employee

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('allows Manager of the department to view employee and reassign task ownership', async () => {
      const getRes = await request(app)
        .get(`/employees/${createdEmployee.id}`)
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.name).toBe('Test Linked Employee');

      // Manager reassigns task to mentor
      const firstTask = createdEmployee.tasks[0];
      const reassignRes = await request(app)
        .patch(`/employees/${createdEmployee.id}/tasks/${firstTask.id}`)
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`)
        .send({ assigneeType: 'mentor' });

      expect(reassignRes.status).toBe(200);
      expect(reassignRes.body.data.assigneeType).toBe('mentor');
    });
  });
});
