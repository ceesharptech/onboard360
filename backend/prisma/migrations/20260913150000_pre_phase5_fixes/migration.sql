-- AlterTable
ALTER TABLE "users" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT true;

-- Update existing users to false so existing seeded/demo/fixture accounts are unaffected
UPDATE "users" SET "must_change_password" = false;

-- AlterTable
ALTER TABLE "onboarding_template_tasks" ADD COLUMN "task_url" TEXT;

-- AlterTable
ALTER TABLE "employee_tasks" ADD COLUMN "task_url" TEXT;
