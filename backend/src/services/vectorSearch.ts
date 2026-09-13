/**
 * Vector search and pgvector isolation module.
 *
 * Per architecture.md Section 3: All raw SQL needed for the pgvector similarity query
 * lives exclusively in this module, never inline in routes or controllers.
 *
 * Security Guarantee (security.md Section 3 & Phase 4 Task 0):
 * All queries use Prisma's tagged template literals (Prisma.sql with $queryRaw and $executeRaw),
 * which automatically compile dynamic interpolations (${companyId}, ${vectorString}, ${topK})
 * into parameterized positional tokens ($1, $2, etc.) sent out-of-band to PostgreSQL.
 * String-concatenating functions like $queryRawUnsafe are strictly forbidden and NOT used here.
 * The vector array string is passed safely as a string parameter and cast in SQL via ::vector.
 */

import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import logger from '../utils/logger';

export interface RetrievedChunk {
  id: string;
  documentId: string;
  companyId: string;
  content: string;
  chunkIndex: number;
  similarity: number;
  documentFilename: string;
}

export interface ChunkToStore {
  content: string;
  chunkIndex: number;
  embedding: number[];
}

export class VectorSearchService {
  /**
   * Search for top-k document chunks closest to the query embedding.
   *
   * Enforces:
   * 1. Multi-tenant company scoping (WHERE c.company_id = companyId)
   * 2. Document readiness (WHERE d.status = 'ready')
   * 3. Parameterized cosine similarity query using pgvector vector_cosine_ops
   */
  async searchSimilarChunks(
    companyId: string,
    queryEmbedding: number[],
    topK = 5
  ): Promise<RetrievedChunk[]> {
    if (!queryEmbedding || queryEmbedding.length !== 384) {
      throw new Error(
        `Invalid query embedding: expected 384 dimensions, got ${queryEmbedding?.length ?? 0}`
      );
    }

    // Format vector string for pgvector casting: "[0.123, -0.456, ...]"
    const vectorString = `[${queryEmbedding.map((n) => Number(n).toFixed(6)).join(',')}]`;

    logger.info(
      { companyId, topK },
      'Executing pgvector cosine similarity search'
    );

    const rawResults = await prisma.$queryRaw<
      Array<{
        id: string;
        documentId: string;
        companyId: string;
        content: string;
        chunkIndex: number;
        similarity: number;
        documentFilename: string;
      }>
    >(
      Prisma.sql`
        SELECT 
          c.id,
          c.document_id AS "documentId",
          c.company_id AS "companyId",
          c.content,
          c.chunk_index AS "chunkIndex",
          (1 - (c.embedding <=> ${vectorString}::vector)) AS similarity,
          d.filename AS "documentFilename"
        FROM document_chunks c
        JOIN documents d ON d.id = c.document_id
        WHERE c.company_id = ${companyId}
          AND d.status = 'ready'
          AND c.embedding IS NOT NULL
        ORDER BY c.embedding <=> ${vectorString}::vector ASC
        LIMIT ${topK};
      `
    );

    return rawResults.map((row) => ({
      ...row,
      similarity: Number(row.similarity),
    }));
  }

  /**
   * Store document chunks with their 384-dimensional embeddings into PostgreSQL.
   * Uses parameterized INSERT statements to handle the Unsupported("vector(384)") column.
   */
  async storeDocumentChunks(
    documentId: string,
    companyId: string,
    chunks: ChunkToStore[]
  ): Promise<void> {
    if (chunks.length === 0) return;

    logger.info(
      { documentId, chunkCount: chunks.length },
      'Storing document chunks into pgvector store'
    );

    await prisma.$transaction(async (tx) => {
      for (const chunk of chunks) {
        const vectorString = `[${chunk.embedding.map((n) => Number(n).toFixed(6)).join(',')}]`;

        await tx.$executeRaw(
          Prisma.sql`
            INSERT INTO document_chunks (
              id,
              document_id,
              company_id,
              content,
              embedding,
              chunk_index,
              created_at
            ) VALUES (
              gen_random_uuid(),
              ${documentId},
              ${companyId},
              ${chunk.content},
              ${vectorString}::vector,
              ${chunk.chunkIndex},
              NOW()
            );
          `
        );
      }
    });

    logger.info(
      { documentId, chunksStored: chunks.length },
      'Successfully stored document chunks'
    );
  }

  /**
   * Delete all chunks for a given document.
   * Note: DB foreign key has ON DELETE CASCADE from documents -> document_chunks,
   * but this method allows explicit cascade clearing on document replacement.
   */
  async deleteDocumentChunks(documentId: string): Promise<number> {
    const deletedCount = await prisma.$executeRaw(
      Prisma.sql`
        DELETE FROM document_chunks
        WHERE document_id = ${documentId};
      `
    );
    logger.info({ documentId, deletedCount }, 'Deleted existing chunks for document');
    return deletedCount;
  }

  /**
   * Count chunks currently stored for a document.
   */
  async countChunksByDocument(documentId: string): Promise<number> {
    const result = await prisma.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`
        SELECT COUNT(*) AS count
        FROM document_chunks
        WHERE document_id = ${documentId};
      `
    );
    return Number(result[0]?.count ?? 0);
  }
}

export default new VectorSearchService();
