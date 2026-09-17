/**
 * Controller for Document Upload, Lifecycle, and Similarity Retrieval.
 */

import { Request, Response, NextFunction } from 'express';
import documentService from '../services/documentService';
import { BadRequestError } from '../utils/errors';
import { paginationQuerySchema } from '../utils/validation';

export class DocumentController {
  /**
   * POST /documents
   * HR Admin only: Upload a new PDF or .docx document.
   */
  async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new BadRequestError('Document file is required', 'FILE_REQUIRED');
      }

      const document = await documentService.createDocument(req.file, {
        userId: req.user!.userId,
        companyId: req.user!.companyId,
      });

      res.status(201).json({ document });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /documents
   * HR Admin: List all documents with status and failure reasons, supporting pagination and search.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = paginationQuerySchema.parse(req.query);
      const result = await documentService.listDocuments(req.user!.companyId, query);
      res.status(200).json({
        status: 'ok',
        data: result.data,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /documents/:id
   * HR Admin: Get single document status and details.
   */
  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const documentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const document = await documentService.getDocument(documentId, req.user!.companyId);
      res.status(200).json({ document });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /documents/:id
   * HR Admin: Re-upload/replace document, cascade-deleting old chunks.
   */
  async replace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new BadRequestError('Replacement document file is required', 'FILE_REQUIRED');
      }

      const documentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const document = await documentService.replaceDocument(
        documentId,
        req.user!.companyId,
        req.file
      );

      res.status(200).json({ document });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /documents/:id
   * HR Admin: Delete document and cascade-remove chunks.
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const documentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      await documentService.deleteDocument(documentId, req.user!.companyId);
      res.status(200).json({ message: 'Document and associated chunks deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /documents/retrieve
   * Authenticated user: Dedicated similarity retrieval endpoint (no LLM).
   */
  async retrieve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { query, topK } = req.body;
      if (!query || typeof query !== 'string') {
        throw new BadRequestError('Search query string is required', 'QUERY_REQUIRED');
      }

      const limit = typeof topK === 'number' && topK > 0 ? Math.min(topK, 20) : 5;
      const chunks = await documentService.retrieveSimilarChunks(
        req.user!.companyId,
        query,
        limit
      );

      res.status(200).json({
        query,
        totalMatches: chunks.length,
        chunks,
      });
    } catch (err) {
      next(err);
    }
  }
}

export default new DocumentController();
