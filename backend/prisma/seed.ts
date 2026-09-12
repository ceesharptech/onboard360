import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEFAULT_ADMIN_EMAIL = 'admin@acme.com';
const DEFAULT_ADMIN_PASSWORD = 'AdminPassword123!';
const DEFAULT_PASSWORD = 'Password123!';

async function main() {
  console.log('Seeding initial data for Onboard360...');

  // 1. Ensure Acme Corporation exists
  let company = await prisma.company.findFirst({
    where: { name: 'Acme Corporation' },
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'Acme Corporation',
      },
    });
    console.log(`Created company: ${company.name} (${company.id})`);
  }

  // 2. Ensure Departments exist: Human Resources and Engineering
  let hrDept = await prisma.department.findFirst({
    where: { companyId: company.id, name: 'Human Resources' },
  });
  if (!hrDept) {
    hrDept = await prisma.department.create({
      data: {
        name: 'Human Resources',
        companyId: company.id,
      },
    });
    console.log(`Created department: Human Resources (${hrDept.id})`);
  }

  let engDept = await prisma.department.findFirst({
    where: { companyId: company.id, name: 'Engineering' },
  });
  if (!engDept) {
    engDept = await prisma.department.create({
      data: {
        name: 'Engineering',
        companyId: company.id,
      },
    });
    console.log(`Created department: Engineering (${engDept.id})`);
  }

  // 3. Ensure HR Admin user exists
  const adminPasswordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);
  let adminUser = await prisma.user.findUnique({
    where: { email: DEFAULT_ADMIN_EMAIL },
  });

  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        companyId: company.id,
        departmentId: hrDept.id,
        email: DEFAULT_ADMIN_EMAIL,
        passwordHash: adminPasswordHash,
        role: 'hr_admin',
      },
    });
    console.log(`Created HR Admin: ${adminUser.email}`);
  }

  // 4. Ensure Engineering Manager user exists
  const standardPasswordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  const engManagerEmail = 'manager.eng@acme.com';
  let engManager = await prisma.user.findUnique({
    where: { email: engManagerEmail },
  });
  if (!engManager) {
    engManager = await prisma.user.create({
      data: {
        companyId: company.id,
        departmentId: engDept.id,
        email: engManagerEmail,
        passwordHash: standardPasswordHash,
        role: 'manager',
      },
    });
    console.log(`Created Engineering Manager: ${engManager.email}`);
  }

  // 5. Ensure Mentors exist in Engineering
  const mentorEmails = ['mentor.alex@acme.com', 'mentor.sam@acme.com'];
  for (const email of mentorEmails) {
    let mentorUser = await prisma.user.findUnique({ where: { email } });
    if (!mentorUser) {
      mentorUser = await prisma.user.create({
        data: {
          companyId: company.id,
          departmentId: engDept.id,
          email,
          passwordHash: standardPasswordHash,
          role: 'employee',
        },
      });
      console.log(`Created mentor user: ${email}`);
    }

    const existingMentor = await prisma.mentor.findFirst({
      where: { companyId: company.id, departmentId: engDept.id, userId: mentorUser.id },
    });
    if (!existingMentor) {
      await prisma.mentor.create({
        data: {
          companyId: company.id,
          departmentId: engDept.id,
          userId: mentorUser.id,
          isActive: true,
          currentMenteeCount: 0,
        },
      });
      console.log(`Added ${email} to Engineering mentor pool`);
    }
  }

  // 6. Seed Default Template 1: Frontend Developer (Engineering)
  const existingFrontendTemplate = await prisma.onboardingTemplate.findFirst({
    where: { companyId: company.id, departmentId: engDept.id, jobRole: 'Frontend Developer' },
  });

  if (!existingFrontendTemplate) {
    const frontendTemplate = await prisma.onboardingTemplate.create({
      data: {
        companyId: company.id,
        departmentId: engDept.id,
        jobRole: 'Frontend Developer',
        name: 'Frontend Developer Onboarding',
        isDefault: true,
        createdBy: adminUser.id,
        tasks: {
          create: [
            {
              title: 'Set up dev environment & SSH keys',
              description: 'Configure git credentials, node/npm environment, and clone local repositories.',
              category: 'IT Setup',
              orderIndex: 0,
              assigneeType: 'employee',
              dueOffsetDays: 1,
            },
            {
              title: 'Clone repositories & run onboarding project',
              description: 'Clone frontend repo, run local dev build, and verify all test suites pass.',
              category: 'Role Training',
              orderIndex: 1,
              assigneeType: 'employee',
              dueOffsetDays: 2,
            },
            {
              title: '1:1 Welcome & 30-day expectations sync',
              description: 'Meet with your Engineering Manager to align on role goals and first sprint assignments.',
              category: 'Role Training',
              orderIndex: 2,
              assigneeType: 'manager',
              dueOffsetDays: 1,
            },
            {
              title: 'Introductory pair programming session',
              description: 'Pair with your assigned mentor on a starter bug fix or small task.',
              category: 'Role Training',
              orderIndex: 3,
              assigneeType: 'mentor',
              dueOffsetDays: 4,
            },
            {
              title: 'Review engineering handbook & architecture docs',
              description: 'Read architectural principles, branching strategies, and CI/CD procedures.',
              category: 'Company Policies',
              orderIndex: 4,
              assigneeType: 'employee',
              dueOffsetDays: 7,
            },
          ],
        },
      },
    });
    console.log(`Created default template: ${frontendTemplate.name} (${frontendTemplate.id})`);
  }

  // 7. Seed Default Template 2: HR Officer (Human Resources)
  const existingHrTemplate = await prisma.onboardingTemplate.findFirst({
    where: { companyId: company.id, departmentId: hrDept.id, jobRole: 'HR Officer' },
  });

  if (!existingHrTemplate) {
    const hrTemplate = await prisma.onboardingTemplate.create({
      data: {
        companyId: company.id,
        departmentId: hrDept.id,
        jobRole: 'HR Officer',
        name: 'HR Officer Onboarding',
        isDefault: true,
        createdBy: adminUser.id,
        tasks: {
          create: [
            {
              title: 'Submit identification & tax documents',
              description: 'Upload required government ID, banking information, and withholding forms.',
              category: 'HR Paperwork',
              orderIndex: 0,
              assigneeType: 'employee',
              dueOffsetDays: 1,
            },
            {
              title: 'Sign employee agreement and confidentiality NDA',
              description: 'Review and sign employment agreement and intellectual property assignment.',
              category: 'HR Paperwork',
              orderIndex: 1,
              assigneeType: 'employee',
              dueOffsetDays: 1,
            },
            {
              title: 'Complete employee health & benefits enrollment',
              description: 'Select medical, dental, and retirement plan options in the benefits portal.',
              category: 'HR Paperwork',
              orderIndex: 2,
              assigneeType: 'employee',
              dueOffsetDays: 3,
            },
            {
              title: 'Review HR code of conduct & employee manual',
              description: 'Read the company policy manual, anti-harassment guide, and security practices.',
              category: 'Company Policies',
              orderIndex: 3,
              assigneeType: 'employee',
              dueOffsetDays: 5,
            },
            {
              title: 'Manager onboarding review & 30-day goals',
              description: 'Meet with Head of HR to review initial casework and quarterly milestones.',
              category: 'Role Training',
              orderIndex: 4,
              assigneeType: 'manager',
              dueOffsetDays: 14,
            },
          ],
        },
      },
    });
    console.log(`Created default template: ${hrTemplate.name} (${hrTemplate.id})`);
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
