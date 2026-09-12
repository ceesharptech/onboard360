import prisma from '../src/utils/prisma';
import { hashPassword } from '../src/utils/password';
import { signAccessToken, UserRole } from '../src/utils/token';

export interface TestTenantFixture {
  company: { id: string; name: string };
  departmentA: { id: string; name: string; companyId: string };
  departmentB: { id: string; name: string; companyId: string };
  hrAdmin: { id: string; email: string; companyId: string; token: string };
  managerDeptA: { id: string; email: string; companyId: string; departmentId: string; token: string };
  managerDeptB: { id: string; email: string; companyId: string; departmentId: string; token: string };
  employee1DeptA: { id: string; email: string; companyId: string; departmentId: string; token: string };
  employee2DeptA: { id: string; email: string; companyId: string; departmentId: string; token: string };
}

/**
 * Creates an isolated test company with departments, users, and tokens.
 * Prefixes names with a unique identifier so test data never collides with development data.
 */
export async function createTestTenantFixture(suffix: string): Promise<TestTenantFixture> {
  const passwordHash = await hashPassword('TestPass123!');

  const company = await prisma.company.create({
    data: {
      name: `Test Company ${suffix}`,
    },
  });

  const departmentA = await prisma.department.create({
    data: {
      name: `Engineering ${suffix}`,
      companyId: company.id,
    },
  });

  const departmentB = await prisma.department.create({
    data: {
      name: `Marketing ${suffix}`,
      companyId: company.id,
    },
  });

  const hrAdminUser = await prisma.user.create({
    data: {
      companyId: company.id,
      departmentId: departmentA.id,
      email: `hr.${suffix}@test.com`,
      passwordHash,
      role: 'hr_admin',
    },
  });

  const managerDeptAUser = await prisma.user.create({
    data: {
      companyId: company.id,
      departmentId: departmentA.id,
      email: `mgr.a.${suffix}@test.com`,
      passwordHash,
      role: 'manager',
    },
  });

  const managerDeptBUser = await prisma.user.create({
    data: {
      companyId: company.id,
      departmentId: departmentB.id,
      email: `mgr.b.${suffix}@test.com`,
      passwordHash,
      role: 'manager',
    },
  });

  const employee1User = await prisma.user.create({
    data: {
      companyId: company.id,
      departmentId: departmentA.id,
      email: `emp1.${suffix}@test.com`,
      passwordHash,
      role: 'employee',
    },
  });

  const employee2User = await prisma.user.create({
    data: {
      companyId: company.id,
      departmentId: departmentA.id,
      email: `emp2.${suffix}@test.com`,
      passwordHash,
      role: 'employee',
    },
  });

  const makeToken = (userId: string, role: UserRole, departmentId: string | null) =>
    signAccessToken({ userId, role, companyId: company.id, departmentId });

  return {
    company,
    departmentA,
    departmentB,
    hrAdmin: {
      id: hrAdminUser.id,
      email: hrAdminUser.email,
      companyId: company.id,
      token: makeToken(hrAdminUser.id, 'hr_admin', null),
    },
    managerDeptA: {
      id: managerDeptAUser.id,
      email: managerDeptAUser.email,
      companyId: company.id,
      departmentId: departmentA.id,
      token: makeToken(managerDeptAUser.id, 'manager', departmentA.id),
    },
    managerDeptB: {
      id: managerDeptBUser.id,
      email: managerDeptBUser.email,
      companyId: company.id,
      departmentId: departmentB.id,
      token: makeToken(managerDeptBUser.id, 'manager', departmentB.id),
    },
    employee1DeptA: {
      id: employee1User.id,
      email: employee1User.email,
      companyId: company.id,
      departmentId: departmentA.id,
      token: makeToken(employee1User.id, 'employee', departmentA.id),
    },
    employee2DeptA: {
      id: employee2User.id,
      email: employee2User.email,
      companyId: company.id,
      departmentId: departmentA.id,
      token: makeToken(employee2User.id, 'employee', departmentA.id),
    },
  };
}

/**
 * Safely cleans up test tenant data without affecting seeded development data.
 */
export async function cleanupTestTenant(companyId: string): Promise<void> {
  // Cascading deletes will remove users, departments, refresh tokens tied to this company
  await prisma.company.deleteMany({
    where: { id: companyId },
  });
}
