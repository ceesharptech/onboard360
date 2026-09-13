-- Phase 3 Migration: Add failure_reason to documents table and HNSW vector index on document_chunks
-- Per AGENTS.md Operating Principle 5, database migrations are append-only.
-- pgvector indexes cannot be expressed directly in Prisma schema because of the
-- Unsupported("vector(384)") column definition, so we define the HNSW cosine index via raw SQL.

-- AlterTable
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "failure_reason" TEXT;

-- CreateIndex
-- Creates an HNSW index on document_chunks.embedding using vector_cosine_ops for fast cosine similarity search.
CREATE INDEX IF NOT EXISTS "document_chunks_embedding_idx" 
ON "document_chunks" 
USING hnsw (embedding vector_cosine_ops);
