-- DropIndex
DROP INDEX "document_chunks_embedding_idx";

-- AlterTable
ALTER TABLE "employee_tasks" ADD COLUMN     "related_document_id" TEXT;

-- AlterTable
ALTER TABLE "onboarding_template_tasks" ADD COLUMN     "related_document_id" TEXT;

-- CreateTable
CREATE TABLE "library_documents" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "department_id" TEXT,
    "filename" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "library_documents_company_id_idx" ON "library_documents"("company_id");

-- CreateIndex
CREATE INDEX "library_documents_department_id_idx" ON "library_documents"("department_id");

-- CreateIndex
CREATE INDEX "employee_tasks_related_document_id_idx" ON "employee_tasks"("related_document_id");

-- CreateIndex
CREATE INDEX "onboarding_template_tasks_related_document_id_idx" ON "onboarding_template_tasks"("related_document_id");

-- AddForeignKey
ALTER TABLE "onboarding_template_tasks" ADD CONSTRAINT "onboarding_template_tasks_related_document_id_fkey" FOREIGN KEY ("related_document_id") REFERENCES "library_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_tasks" ADD CONSTRAINT "employee_tasks_related_document_id_fkey" FOREIGN KEY ("related_document_id") REFERENCES "library_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_documents" ADD CONSTRAINT "library_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_documents" ADD CONSTRAINT "library_documents_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_documents" ADD CONSTRAINT "library_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
