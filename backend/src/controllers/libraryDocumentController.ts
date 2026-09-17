import { Request, Response, NextFunction } from 'express';
import libraryDocumentService from '../services/libraryDocumentService';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import { paginationQuerySchema } from '../utils/validation';

export class LibraryDocumentController {
  /**
   * POST /library-documents
   * HR Admin (company-wide or department) or Manager (own department only).
   */
  async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required', 'UNAUTHORIZED');
      }

      if (!req.file) {
        throw new BadRequestError('Document file is required', 'FILE_REQUIRED');
      }

      const departmentId = req.body.departmentId && req.body.departmentId.trim() !== ''
        ? req.body.departmentId.trim()
        : null;

      const document = await libraryDocumentService.createDocument(req.file, req.user, {
        departmentId,
      });

      res.status(201).json({
        status: 'ok',
        data: document,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /library-documents
   * Scoped by role, paginated and searchable.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required', 'UNAUTHORIZED');
      }

      const query = paginationQuerySchema.parse(req.query);
      const result = await libraryDocumentService.listDocuments(req.user, {
        page: query.page,
        limit: query.limit,
        search: query.search,
        departmentId: req.query.departmentId as string | undefined,
      });

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
   * GET /library-documents/:id
   * Get document metadata.
   */
  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required', 'UNAUTHORIZED');
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const document = await libraryDocumentService.getDocument(id, req.user);

      res.status(200).json({
        status: 'ok',
        data: document,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /library-documents/:id/download
   * Stream the file for download or inline view.
   */
  async download(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required', 'UNAUTHORIZED');
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { stream, filename, contentType } = await libraryDocumentService.getFileStream(id, req.user);

      const encodedFilename = encodeURIComponent(filename);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedFilename}`);

      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /library-documents/:id
   * Replace file with a new PDF/.docx (no version history).
   */
  async replace(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required', 'UNAUTHORIZED');
      }

      if (!req.file) {
        throw new BadRequestError('Replacement document file is required', 'FILE_REQUIRED');
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const updated = await libraryDocumentService.replaceDocument(id, req.file, req.user);

      res.status(200).json({
        status: 'ok',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /library-documents/:id
   * Delete document and unlink referencing tasks.
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required', 'UNAUTHORIZED');
      }

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      await libraryDocumentService.deleteDocument(id, req.user);

      res.status(200).json({
        status: 'ok',
        message: 'Library document deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }
}

export const libraryDocumentController = new LibraryDocumentController();
export default libraryDocumentController;
