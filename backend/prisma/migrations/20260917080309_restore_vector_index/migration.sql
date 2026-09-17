-- Restore HNSW vector index on document_chunks.embedding
-- pgvector indexes cannot be modeled directly in Prisma schema due to Unsupported("vector(384)")
CREATE INDEX IF NOT EXISTS "document_chunks_embedding_idx" 
ON "document_chunks" 
USING hnsw (embedding vector_cosine_ops);