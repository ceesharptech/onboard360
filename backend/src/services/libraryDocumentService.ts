/**
 * Service for the Document Library (Phase 5.4).
 *
 * Distinct from Phase 3 Knowledge Base (documents/document_chunks):
 * - Never processed for embeddings or chunked.
 * - Never queried or cited by Qorra RAG assistant.
 * - Scoped for human browsing: company-wide or department-specific.
 * - Enforces role-based visibility:
 *     * HR Admin: Full company-wide and departmental management.
 *     * Manager: Scoped to own department management; can view company-wide.
 *     * Employee: Read-only access to company-wide + own department documents.
 * - No version history: replacement overwrites file and updates record in place.
 */

import fs from 'fs';
import path from 'path';
import prisma from '../utils/prisma';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors';
import { UserTokenPayload } from '../utils/token';
import logger from '../utils/logger';

export interface LibraryDocumentUploadMeta {
  departmentId?: string | null;
}

export interface LibraryDocumentListQuery {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
}

export class LibraryDocumentService {
  /**
   * Upload a new document into the library.
   * HR Admin: Can upload company-wide (departmentId=null) or to any company department.
   * Manager: Can only upload to their own department (departmentId is enforced to manager's department).
   * Employee: Not permitted (handled by requireRole).
   */
  async createDocument(
    file: Express.Multer.File,
    user: UserTokenPayload,
    meta?: LibraryDocumentUploadMeta
  ) {
    let targetDepartmentId: string | null = null;

    if (user.role === 'manager') {
      if (!user.departmentId) {
        throw new ForbiddenError('Managers without an assigned department cannot upload documents', 'DEPARTMENT_REQUIRED');
      }
      targetDepartmentId = user.departmentId;
    } else if (user.role === 'hr_admin') {
      if (meta?.departmentId) {
        // Validate department belongs to HR Admin's company
        const dept = await prisma.department.findFirst({
          where: { id: meta.departmentId, companyId: user.companyId },
        });
        if (!dept) {
          throw new NotFoundError('Specified department not found in company', 'NOT_FOUND');
        }
        targetDepartmentId = dept.id;
      } else {
        targetDepartmentId = null; // Company-wide
      }
    } else {
      throw new ForbiddenError('Employees do not have upload permissions for library documents', 'FORBIDDEN');
    }

    const doc = await prisma.libraryDocument.create({
      data: {
        companyId: user.companyId,
        departmentId: targetDepartmentId,
        filename: file.originalname,
        storagePath: file.path,
        uploadedBy: user.userId,
        status: 'ready',
      },
      include: {
        department: { select: { id: true, name: true } },
        uploader: { select: { id: true, email: true, role: true } },
      },
    });

    logger.info(
      { documentId: doc.id, filename: doc.filename, departmentId: doc.departmentId, companyId: user.companyId },
      'Uploaded library document'
    );

    return doc;
  }

  /**
   * List library documents accessible to the user, with pagination and search.
   */
  async listDocuments(user: UserTokenPayload, query: LibraryDocumentListQuery = {}) {
    const page = Math.max(1, query.page || 1);
    const rawLimit = query.limit ?? 20;
    const limit = Math.min(100, Math.max(1, rawLimit));
    const skip = (page - 1) * limit;

    const where: any = { companyId: user.companyId };

    // Role-based visibility scoping
    if (user.role === 'hr_admin') {
      if (query.departmentId) {
        if (query.departmentId === 'company_wide') {
          where.departmentId = null;
        } else {
          where.departmentId = query.departmentId;
        }
      }
    } else if (user.role === 'manager' || user.role === 'employee') {
      const userDeptId = user.departmentId;
      if (userDeptId) {
        where.OR = [
          { departmentId: null }, // Company-wide
          { departmentId: userDeptId }, // User's department
        ];
      } else {
        // If user has no department assigned, they only see company-wide documents
        where.departmentId = null;
      }

      if (query.departmentId) {
        if (query.departmentId === 'company_wide') {
          where.departmentId = null;
          delete where.OR;
        } else if (query.departmentId === userDeptId) {
          where.departmentId = userDeptId;
          delete where.OR;
        } else {
          // Attempting to filter by another department: return empty list
          return {
            data: [],
            pagination: {
              total: 0,
              page,
              limit,
              totalPages: 0,
              hasNextPage: false,
              hasPrevPage: false,
            },
          };
        }
      }
    }

    if (query.search && query.search.trim()) {
      where.filename = { contains: query.search.trim(), mode: 'insensitive' };
    }

    const [total, documents] = await Promise.all([
      prisma.libraryDocument.count({ where }),
      prisma.libraryDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          department: { select: { id: true, name: true } },
          uploader: { select: { id: true, email: true, role: true } },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: documents,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Get a single document by ID, checking access visibility.
   */
  async getDocument(id: string, user: UserTokenPayload) {
    const doc = await prisma.libraryDocument.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        department: { select: { id: true, name: true } },
        uploader: { select: { id: true, email: true, role: true } },
      },
    });

    if (!doc) {
      throw new NotFoundError('Library document not found', 'NOT_FOUND');
    }

    // Access check for manager and employee: must be company-wide or match their department
    if (user.role !== 'hr_admin') {
      const isCompanyWide = doc.departmentId === null;
      const isUserDept = Boolean(user.departmentId && doc.departmentId === user.departmentId);

      if (!isCompanyWide && !isUserDept) {
        // Return 404 to avoid leaking existence of out-of-scope documents
        throw new NotFoundError('Library document not found', 'NOT_FOUND');
      }
    }

    return doc;
  }

  /**
   * Get file stream and metadata for downloading/viewing.
   */
  async getFileStream(id: string, user: UserTokenPayload) {
    const doc = await this.getDocument(id, user);

    if (!fs.existsSync(doc.storagePath)) {
      throw new NotFoundError('Document file not found on storage server', 'FILE_NOT_FOUND');
    }

    const ext = path.extname(doc.filename).toLowerCase();
    const contentType =
      ext === '.pdf'
        ? 'application/pdf'
        : ext === '.docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/octet-stream';

    const stream = fs.createReadStream(doc.storagePath);

    return {
      stream,
      filename: doc.filename,
      contentType,
    };
  }

  /**
   * Replace a library document file (no version history).
   * Overwrites storage, deletes old file from disk, updates filename and path.
   */
  async replaceDocument(id: string, file: Express.Multer.File, user: UserTokenPayload) {
    const doc = await this.getDocument(id, user);

    // Only HR Admin or the Manager of this document's department can replace
    if (user.role === 'manager') {
      if (!doc.departmentId || doc.departmentId !== user.departmentId) {
        throw new ForbiddenError('Managers can only replace documents scoped to their own department', 'FORBIDDEN');
      }
    } else if (user.role !== 'hr_admin') {
      throw new ForbiddenError('Employees cannot replace library documents', 'FORBIDDEN');
    }

    const oldPath = doc.storagePath;

    const updated = await prisma.libraryDocument.update({
      where: { id: doc.id },
      data: {
        filename: file.originalname,
        storagePath: file.path,
        status: 'ready',
      },
      include: {
        department: { select: { id: true, name: true } },
        uploader: { select: { id: true, email: true, role: true } },
      },
    });

    // Remove old physical file from disk
    try {
      if (fs.existsSync(oldPath) && oldPath !== file.path) {
        fs.unlinkSync(oldPath);
      }
    } catch (err) {
      logger.warn({ oldPath, err }, 'Failed to delete replaced library file from disk');
    }

    logger.info({ documentId: doc.id, newFilename: updated.filename }, 'Replaced library document');

    return updated;
  }

  /**
   * Delete a library document.
   * Cascade SetNull handles any tasks referencing this document in Postgres.
   */
  async deleteDocument(id: string, user: UserTokenPayload) {
    const doc = await this.getDocument(id, user);

    // Only HR Admin or Manager of own department can delete
    if (user.role === 'manager') {
      if (!doc.departmentId || doc.departmentId !== user.departmentId) {
        throw new ForbiddenError('Managers can only delete documents scoped to their own department', 'FORBIDDEN');
      }
    } else if (user.role !== 'hr_admin') {
      throw new ForbiddenError('Employees cannot delete library documents', 'FORBIDDEN');
    }

    // Delete DB record
    await prisma.libraryDocument.delete({
      where: { id: doc.id },
    });

    // Remove physical file from disk
    try {
      if (fs.existsSync(doc.storagePath)) {
        fs.unlinkSync(doc.storagePath);
      }
    } catch (err) {
      logger.warn({ storagePath: doc.storagePath, err }, 'Failed to delete library document file from disk');
    }

    logger.info({ documentId: doc.id, filename: doc.filename }, 'Deleted library document');

    return { success: true };
  }
}

export const libraryDocumentService = new LibraryDocumentService();
export default libraryDocumentService;
