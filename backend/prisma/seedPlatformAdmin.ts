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

async function seedPlatformAdmin() {
  const email = process.env.PLATFORM_ADMIN_EMAIL || 'admin@onboard360.internal';
  const password = process.env.PLATFORM_ADMIN_PASSWORD || 'PlatformAdmin2026!';

  console.log(`[Platform Admin Seed] Seeding platform admin account for: ${email}`);

  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const admin = await prisma.platformAdmin.upsert({
    where: { email },
    update: { passwordHash },
    create: {
      email,
      passwordHash,
    },
  });

  console.log(`[Platform Admin Seed] Successfully provisioned platform admin account:`);
  console.log(`  ID:    ${admin.id}`);
  console.log(`  Email: ${admin.email}`);
  console.log(`  Date:  ${admin.createdAt.toISOString()}`);
}

seedPlatformAdmin()
  .catch((e) => {
    console.error('[Platform Admin Seed] Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
