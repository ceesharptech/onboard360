-- CreateTable
CREATE TABLE "training_entries" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "youtube_video_id" TEXT,
    "guide_content" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "training_entries_company_id_idx" ON "training_entries"("company_id");

-- AddForeignKey
ALTER TABLE "training_entries" ADD CONSTRAINT "training_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_entries" ADD CONSTRAINT "training_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
