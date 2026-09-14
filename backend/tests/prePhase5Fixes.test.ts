import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/utils/prisma';
import { createTestTenantFixture, cleanupTestTenant, TestTenantFixture } from './testUtils';

describe('Pre-Phase-5 Corrective Batch Tests', () => {
  let fixture: TestTenantFixture;
  const suffix = `fixes_${Date.now()}`;

  beforeAll(async () => {
    fixture = await createTestTenantFixture(suffix);
  });

  afterAll(async () => {
    if (fixture?.company?.id) {
      await cleanupTestTenant(fixture.company.id);
    }
  });

  describe('Fix 1 — Unified Employee/Account Creation + Forced Password Change', () => {
    const managerEmail = `mgr_created_${suffix}@test.com`;
    const employeeEmail = `emp_created_${suffix}@test.com`;
    const hrAdminEmail = `hr_created_${suffix}@test.com`;
    const tempPassword = 'InitialPass123!';
    const newPassword = 'NewSecretPass123!';

    it('creates an Employee account with must_change_password = true and hashed initial password', async () => {
      const res = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: 'Jane Doe',
          email: employeeEmail,
          role: 'employee',
          initialPassword: tempPassword,
          departmentId: fixture.departmentA.id,
          jobRole: 'Frontend Engineer',
          startDate: '2026-10-01',
          employmentType: 'full_time',
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ok');
      expect(res.body.data.email).toBe(employeeEmail);

      const user = await prisma.user.findUnique({ where: { email: employeeEmail } });
      expect(user).toBeDefined();
      expect(user?.role).toBe('employee');
      expect(user?.mustChangePassword).toBe(true);
    });

    it('creates a Manager account with role=manager and must_change_password = true', async () => {
      const res = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: 'Alex Manager',
          email: managerEmail,
          role: 'manager',
          initialPassword: tempPassword,
          departmentId: fixture.departmentA.id,
          jobRole: 'Engineering Manager',
          startDate: '2026-10-01',
          employmentType: 'full_time',
        });

      expect(res.status).toBe(201);
      const user = await prisma.user.findUnique({ where: { email: managerEmail } });
      expect(user).toBeDefined();
      expect(user?.role).toBe('manager');
      expect(user?.mustChangePassword).toBe(true);
    });

    it('creates an HR Admin account with role=hr_admin and no department/tasks', async () => {
      const res = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: 'New HR Administrator',
          email: hrAdminEmail,
          role: 'hr_admin',
          initialPassword: tempPassword,
        });

      expect(res.status).toBe(201);
      const user = await prisma.user.findUnique({ where: { email: hrAdminEmail } });
      expect(user).toBeDefined();
      expect(user?.role).toBe('hr_admin');
      expect(user?.departmentId).toBeNull();
      expect(user?.mustChangePassword).toBe(true);
    });

    it('intercepts login when must_change_password = true and returns distinct status without tokens', async () => {
      const loginRes = await request(app)
        .post('/auth/login')
        .send({
          email: employeeEmail,
          password: tempPassword,
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.status).toBe('must_change_password');
      expect(loginRes.body.data.mustChangePassword).toBe(true);
      expect(loginRes.body.data.email).toBe(employeeEmail);
      expect(loginRes.body.data.accessToken).toBeUndefined();
      expect(loginRes.body.data.refreshToken).toBeUndefined();
    });

    it('enforces password change on POST /auth/change-password and issues real tokens upon success', async () => {
      // 1. Attempt with incorrect current password -> 401
      const failRes = await request(app)
        .post('/auth/change-password')
        .send({
          email: employeeEmail,
          currentPassword: 'WrongPassword!',
          newPassword: newPassword,
        });

      expect(failRes.status).toBe(401);

      // 2. Attempt with weak new password -> 400 validation error
      const weakRes = await request(app)
        .post('/auth/change-password')
        .send({
          email: employeeEmail,
          currentPassword: tempPassword,
          newPassword: 'weak',
        });

      expect(weakRes.status).toBe(400);

      // 3. Successful change
      const successRes = await request(app)
        .post('/auth/change-password')
        .send({
          email: employeeEmail,
          currentPassword: tempPassword,
          newPassword: newPassword,
        });

      expect(successRes.status).toBe(200);
      expect(successRes.body.status).toBe('ok');
      expect(successRes.body.data.accessToken).toBeDefined();
      expect(successRes.body.data.refreshToken).toBeDefined();
      expect(successRes.body.data.user.email).toBe(employeeEmail);

      // 4. Verify DB flag updated
      const updatedUser = await prisma.user.findUnique({ where: { email: employeeEmail } });
      expect(updatedUser?.mustChangePassword).toBe(false);

      // 5. Subsequent normal login succeeds directly
      const nextLoginRes = await request(app)
        .post('/auth/login')
        .send({
          email: employeeEmail,
          password: newPassword,
        });

      expect(nextLoginRes.status).toBe(200);
      expect(nextLoginRes.body.status).toBe('ok');
      expect(nextLoginRes.body.data.accessToken).toBeDefined();

      // 6. Employee can list their own onboarding record via GET /employees
      const listEmpRes = await request(app)
        .get('/employees')
        .set('Authorization', `Bearer ${nextLoginRes.body.data.accessToken}`);

      expect(listEmpRes.status).toBe(200);
      expect(listEmpRes.body.data.length).toBe(1);
      expect(listEmpRes.body.data[0].email).toBe(employeeEmail);
      expect(listEmpRes.body.data[0].name).toBe('Jane Doe');
    });
  });

  describe('Fix 2 — Mentor Pool UX & Task Visibility', () => {
    let mentorUser: any;
    let menteeEmployee: any;
    let mentorRecord: any;

    beforeAll(async () => {
      // Create user to become mentor
      mentorUser = fixture.employee2DeptA;

      // Add user to departmentA mentor pool
      const addMentorRes = await request(app)
        .post(`/departments/${fixture.departmentA.id}/mentors`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({ userId: mentorUser.id });

      mentorRecord = addMentorRes.body.data;

      // Create a template with both manager and mentor assigned tasks
      const tplRes = await request(app)
        .post('/templates')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: 'Task Visibility Template',
          departmentId: fixture.departmentA.id,
          jobRole: 'Visibility Role',
          tasks: [
            {
              title: 'Manager 1-on-1 Check-in',
              category: 'Manager Check',
              orderIndex: 0,
              assigneeType: 'manager',
              dueOffsetDays: 2,
              taskUrl: 'https://linear.app/task/1',
            },
            {
              title: 'Mentor Codebase Tour',
              category: 'Mentorship',
              orderIndex: 1,
              assigneeType: 'mentor',
              dueOffsetDays: 3,
              taskUrl: 'https://github.com/org/repo',
            },
          ],
        });

      // Create employee assigned to this mentor
      const empRes = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: 'Mentee Under Test',
          email: `mentee_visibility_${suffix}@test.com`,
          role: 'employee',
          departmentId: fixture.departmentA.id,
          jobRole: 'Visibility Role',
          startDate: '2026-10-01',
          employmentType: 'full_time',
          mentorId: mentorRecord.id,
        });

      menteeEmployee = empRes.body.data;
    });

    it('returns assigned mentees and progress within GET /departments/:id/mentors', async () => {
      const res = await request(app)
        .get(`/departments/${fixture.departmentA.id}/mentors`)
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`);

      expect(res.status).toBe(200);
      const mentors = res.body.data;
      const targetMentor = mentors.find((m: any) => m.id === mentorRecord.id);
      expect(targetMentor).toBeDefined();
      expect(targetMentor.mentees).toBeDefined();
      expect(targetMentor.mentees.length).toBeGreaterThan(0);
      expect(targetMentor.mentees[0].name).toBe('Mentee Under Test');
      expect(targetMentor.mentees[0].progress).toBeDefined();
      expect(targetMentor.mentees[0].progress.totalTasks).toBe(2);
    });

    it('allows Manager to view assigned tasks via GET /employees/manager/assigned-tasks and toggle completion', async () => {
      // 1. Manager fetches assigned tasks for department
      const tasksRes = await request(app)
        .get('/employees/manager/assigned-tasks')
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`);

      expect(tasksRes.status).toBe(200);
      expect(tasksRes.body.data.length).toBeGreaterThan(0);

      const managerTask = tasksRes.body.data.find(
        (t: any) => t.title === 'Manager 1-on-1 Check-in' && t.employee.id === menteeEmployee.id
      );
      expect(managerTask).toBeDefined();
      expect(managerTask.assigneeType).toBe('manager');
      expect(managerTask.taskUrl).toBe('https://linear.app/task/1');

      // 2. Manager toggles task completion
      const toggleRes = await request(app)
        .patch(`/employees/${menteeEmployee.id}/tasks/${managerTask.id}`)
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`)
        .send({ status: 'completed' });

      expect(toggleRes.status).toBe(200);
      expect(toggleRes.body.data.status).toBe('completed');
      expect(toggleRes.body.data.completedAt).toBeDefined();
    });

    it('enforces that Manager from Department B cannot see or toggle Department A tasks', async () => {
      const deptBRes = await request(app)
        .get('/employees/manager/assigned-tasks')
        .set('Authorization', `Bearer ${fixture.managerDeptB.token}`);

      expect(deptBRes.status).toBe(200);
      // Manager B should have 0 tasks from department A
      const crossDeptTasks = deptBRes.body.data.filter(
        (t: any) => t.employee.department.id === fixture.departmentA.id
      );
      expect(crossDeptTasks.length).toBe(0);
    });

    it('allows active Mentor to view mentees via GET /employees/mentor/my-mentees and toggle mentor task', async () => {
      // 1. Mentor fetches their mentees
      const menteeDataRes = await request(app)
        .get('/employees/mentor/my-mentees')
        .set('Authorization', `Bearer ${mentorUser.token}`);

      expect(menteeDataRes.status).toBe(200);
      expect(menteeDataRes.body.data.isMentor).toBe(true);
      expect(menteeDataRes.body.data.mentees.length).toBeGreaterThan(0);

      const mentee = menteeDataRes.body.data.mentees.find((m: any) => m.id === menteeEmployee.id);
      expect(mentee).toBeDefined();
      expect(mentee.mentorTasks.length).toBe(1);
      expect(mentee.mentorTasks[0].title).toBe('Mentor Codebase Tour');
      expect(mentee.mentorTasks[0].taskUrl).toBe('https://github.com/org/repo');

      const mentorTaskId = mentee.mentorTasks[0].id;

      // 2. Mentor completes the mentor task
      const completeRes = await request(app)
        .patch(`/employees/${menteeEmployee.id}/tasks/${mentorTaskId}`)
        .set('Authorization', `Bearer ${mentorUser.token}`)
        .send({ status: 'completed' });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.status).toBe('completed');
    });

    it('forbids Mentor from completing tasks not assigned to mentor (e.g. employee/manager tasks, returns 404)', async () => {
      // Get manager task from created employee
      const managerTask = menteeEmployee.tasks.find((t: any) => t.assigneeType === 'manager');
      expect(managerTask).toBeDefined();

      // Mentor attempts to update manager task -> 404 Not Found (scoped out)
      const patchRes = await request(app)
        .patch(`/employees/${menteeEmployee.id}/tasks/${managerTask.id}`)
        .set('Authorization', `Bearer ${mentorUser.token}`)
        .send({ status: 'pending' });

      expect(patchRes.status).toBe(404);
      expect(patchRes.body.error.code).toBe('NOT_FOUND');
    });

    it('enforces cross-mentor and direct employee record isolation (returns 404)', async () => {
      // Mentor cannot access mentee's full employee record directly (must use /mentor/my-mentees)
      const mentorDirectRes = await request(app)
        .get(`/employees/${menteeEmployee.id}`)
        .set('Authorization', `Bearer ${mentorUser.token}`);

      expect(mentorDirectRes.status).toBe(404);

      // Other employee (not mentor) cannot access mentee record
      const unauthorizedRes = await request(app)
        .get(`/employees/${menteeEmployee.id}`)
        .set('Authorization', `Bearer ${fixture.employee1DeptA.token}`);

      expect(unauthorizedRes.status).toBe(404);
    });
  });

  describe('Fix 3 — Optional Task Link Field Snapshotting', () => {
    it('snapshots taskUrl from template to employee tasks correctly', async () => {
      const tplRes = await request(app)
        .post('/templates')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: 'Link Verification Template',
          departmentId: fixture.departmentA.id,
          jobRole: 'Link Tester',
          tasks: [
            {
              title: 'Task With Link',
              category: 'Docs',
              orderIndex: 0,
              assigneeType: 'employee',
              dueOffsetDays: 1,
              taskUrl: 'https://notion.so/my-workspace/doc-1',
            },
            {
              title: 'Task Without Link',
              category: 'Docs',
              orderIndex: 1,
              assigneeType: 'employee',
              dueOffsetDays: 2,
              taskUrl: null,
            },
          ],
        });

      expect(tplRes.status).toBe(201);

      const empRes = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: 'Link Tester Employee',
          email: `link_tester_${suffix}@test.com`,
          departmentId: fixture.departmentA.id,
          jobRole: 'Link Tester',
          startDate: '2026-10-01',
          employmentType: 'full_time',
        });

      expect(empRes.status).toBe(201);
      const tasks = empRes.body.data.tasks;
      expect(tasks.length).toBe(2);

      const withLink = tasks.find((t: any) => t.title === 'Task With Link');
      const withoutLink = tasks.find((t: any) => t.title === 'Task Without Link');

      expect(withLink.taskUrl).toBe('https://notion.so/my-workspace/doc-1');
      expect(withoutLink.taskUrl).toBeNull();
    });
  });
});
