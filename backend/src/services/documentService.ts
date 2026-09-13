/**
 * Document processing and lifecycle management service.
 *
 * Enforces:
 * - Document status lifecycle persisted in DB: pending -> processing -> ready | failed
 * - Cascade chunk replacement and deletion (DB ON DELETE CASCADE + disk cleanup)
 * - Integration with rag-service for extraction, chunking, and embedding generation
 * - Company-scoped retrieval queries via vectorSearchService
 */

import fs from 'fs';
import path from 'path';
import prisma from '../utils/prisma';
import vectorSearchService, { RetrievedChunk } from './vectorSearch';
import { NotFoundError, BadRequestError } from '../utils/errors';
import logger from '../utils/logger';

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://127.0.0.1:8000';

export interface DocumentWithMeta {
  id: string;
  companyId: string;
  uploadedBy: string;
  filename: string;
  storagePath: string;
  status: string;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  chunkCount?: number;
}

export class DocumentService {
  /**
   * Upload a new document: validates, persists with status='pending', and triggers processing.
   */
  async createDocument(
    file: Express.Multer.File,
    user: { userId: string; companyId: string }
  ): Promise<DocumentWithMeta> {
    const document = await prisma.document.create({
      data: {
        companyId: user.companyId,
        uploadedBy: user.userId,
        filename: file.originalname,
        storagePath: file.path,
        status: 'pending',
      },
    });

    logger.info(
      { documentId: document.id, filename: file.originalname, companyId: user.companyId },
      'Document created with status=pending. Initiating processing pipeline.'
    );

    // Trigger processing pipeline
    this.processDocument(document.id, file.path, file.originalname, user.companyId).catch(
      (err) => {
        logger.error(
          { documentId: document.id, err: err instanceof Error ? err.message : String(err) },
          'Unhandled exception in async document processing'
        );
      }
    );

    return {
      ...document,
      chunkCount: 0,
    };
  }

  /**
   * Process a document through rag-service: extraction -> recursive chunking -> embeddings -> pgvector storage.
   * Updates status with immediate DB persistence: pending -> processing -> ready | failed.
   */
  async processDocument(
    documentId: string,
    filePath: string,
    filename: string,
    companyId: string
  ): Promise<void> {
    // 1. Transition status to 'processing'
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'processing', failureReason: null },
    });
    logger.info({ documentId }, 'Document status transitioned to processing');

    try {
      // 2. Call rag-service /process-file
      const normalizedPath = path.resolve(filePath);
      const response = await fetch(`${RAG_SERVICE_URL}/process-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: normalizedPath,
          filename,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        const errorMessage =
          typeof errorData.detail === 'string'
            ? errorData.detail
            : JSON.stringify(errorData.detail || 'Extraction and processing failed');

        throw new Error(errorMessage);
      }

      const result = (await response.json()) as {
        filename: string;
        total_chunks: number;
        chunks: Array<{
          content: string;
          chunk_index: number;
          embedding: number[];
        }>;
      };

      if (!result.chunks || result.chunks.length === 0) {
        throw new Error('No extractable text chunks produced from document');
      }

      // 3. Store chunks with embeddings in pgvector via isolated vector search module
      const chunksToStore = result.chunks.map((c) => ({
        content: c.content,
        chunkIndex: c.chunk_index,
        embedding: c.embedding,
      }));

      await vectorSearchService.storeDocumentChunks(documentId, companyId, chunksToStore);

      // 4. Transition status to 'ready'
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'ready',
          failureReason: null,
        },
      });

      logger.info(
        { documentId, chunkCount: result.chunks.length },
        'Document successfully processed and ready for retrieval'
      );
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : 'Unknown extraction or processing error';
      logger.warn({ documentId, failureReason: reason }, 'Document processing failed');

      // Persist failure status and reason immediately to the database
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'failed',
          failureReason: reason,
        },
      });
    }
  }

  /**
   * Replace/Re-upload a document: cascade-deletes prior chunks and triggers fresh processing.
   */
  async replaceDocument(
    documentId: string,
    companyId: string,
    file: Express.Multer.File
  ): Promise<DocumentWithMeta> {
    const existing = await prisma.document.findFirst({
      where: { id: documentId, companyId },
    });

    if (!existing) {
      throw new NotFoundError('Document not found in company scope', 'NOT_FOUND');
    }

    // 1. Cascade-delete old chunks from document_chunks before inserting new ones
    await vectorSearchService.deleteDocumentChunks(documentId);

    // 2. Clean up old physical file if path changed
    if (existing.storagePath && existing.storagePath !== file.path && fs.existsSync(existing.storagePath)) {
      try {
        fs.unlinkSync(existing.storagePath);
      } catch (e) {
        logger.warn({ path: existing.storagePath }, 'Could not remove prior physical file');
      }
    }

    // 3. Reset document record to 'pending'
    const updated = await prisma.document.update({
      where: { id: documentId },
      data: {
        filename: file.originalname,
        storagePath: file.path,
        status: 'pending',
        failureReason: null,
      },
    });

    logger.info(
      { documentId, filename: file.originalname },
      'Document replaced. Prior chunks deleted. Re-initiating processing pipeline.'
    );

    // 4. Trigger processing pipeline
    this.processDocument(documentId, file.path, file.originalname, companyId).catch((err) => {
      logger.error({ documentId, err }, 'Async processing error on replacement');
    });

    return {
      ...updated,
      chunkCount: 0,
    };
  }

  /**
   * Delete document: unlinks raw file from disk and deletes DB row (cascade-deleting chunks).
   */
  async deleteDocument(documentId: string, companyId: string): Promise<void> {
    const doc = await prisma.document.findFirst({
      where: { id: documentId, companyId },
    });

    if (!doc) {
      throw new NotFoundError('Document not found in company scope', 'NOT_FOUND');
    }

    // Remove file from disk
    if (doc.storagePath && fs.existsSync(doc.storagePath)) {
      try {
        fs.unlinkSync(doc.storagePath);
      } catch (e) {
        logger.warn({ path: doc.storagePath }, 'Failed to delete file from disk');
      }
    }

    // Delete DB record (ON DELETE CASCADE in PostgreSQL removes document_chunks automatically)
    await prisma.document.delete({
      where: { id: documentId },
    });

    logger.info({ documentId, companyId }, 'Document deleted and chunks cascade-removed');
  }

  /**
   * List all documents for the authenticated company, including chunk counts.
   */
  async listDocuments(companyId: string): Promise<DocumentWithMeta[]> {
    const docs = await prisma.document.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });

    return docs.map((doc) => ({
      id: doc.id,
      companyId: doc.companyId,
      uploadedBy: doc.uploadedBy,
      filename: doc.filename,
      storagePath: doc.storagePath,
      status: doc.status,
      failureReason: doc.failureReason,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      chunkCount: doc._count.chunks,
    }));
  }

  /**
   * Get single document details within company scope.
   */
  async getDocument(documentId: string, companyId: string): Promise<DocumentWithMeta> {
    const doc = await prisma.document.findFirst({
      where: { id: documentId, companyId },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });

    if (!doc) {
      throw new NotFoundError('Document not found in company scope', 'NOT_FOUND');
    }

    return {
      id: doc.id,
      companyId: doc.companyId,
      uploadedBy: doc.uploadedBy,
      filename: doc.filename,
      storagePath: doc.storagePath,
      status: doc.status,
      failureReason: doc.failureReason,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      chunkCount: doc._count.chunks,
    };
  }

  /**
   * Dedicated similarity retrieval function (no LLM).
   * Embeds question string via rag-service and returns top-k cosine matches from pgvector.
   */
  async retrieveSimilarChunks(
    companyId: string,
    query: string,
    topK = 5
  ): Promise<RetrievedChunk[]> {
    if (!query || !query.trim()) {
      throw new BadRequestError('Search query must not be empty', 'BAD_REQUEST');
    }

    logger.info({ companyId, query, topK }, 'Retrieving similar document chunks');

    // 1. Call rag-service /embed to get 384-d vector for query
    const embedResponse = await fetch(`${RAG_SERVICE_URL}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: query.trim() }),
    });

    if (!embedResponse.ok) {
      const err = await embedResponse.text();
      throw new Error(`Failed to generate query embedding: ${err}`);
    }

    const embedResult = (await embedResponse.json()) as { embedding: number[] };
    if (!embedResult.embedding || embedResult.embedding.length !== 384) {
      throw new Error('Embedding service returned invalid vector dimensions');
    }

    // 2. Perform parameterized similarity search via vectorSearchService
    return vectorSearchService.searchSimilarChunks(companyId, embedResult.embedding, topK);
  }
}

export default new DocumentService();
