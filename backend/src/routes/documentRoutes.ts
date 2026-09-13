/**
 * Routes for Document Upload, Lifecycle, and Similarity Retrieval.
 *
 * Implements RBAC per Phase 1 authorization middleware:
 * - HR Admin only for document management (upload, list, replace, delete)
 * - Authenticated users for similarity retrieval (scoped by company_id)
 */

import { Router } from 'express';
import documentController from '../controllers/documentController';
import { requireRole } from '../middleware/auth';
import { uploadFile, validateMagicBytes } from '../middleware/upload';

const router = Router();

// Dedicated similarity retrieval endpoint (no LLM) - accessible to all authenticated company users
router.post(
  '/retrieve',
  documentController.retrieve.bind(documentController)
);

// Document management endpoints - strictly HR Admin only
router.post(
  '/',
  uploadFile('file'),
  requireRole('hr_admin'),
  validateMagicBytes,
  documentController.upload.bind(documentController)
);

router.get(
  '/',
  requireRole('hr_admin'),
  documentController.list.bind(documentController)
);

router.get(
  '/:id',
  requireRole('hr_admin'),
  documentController.getOne.bind(documentController)
);

router.put(
  '/:id',
  uploadFile('file'),
  requireRole('hr_admin'),
  validateMagicBytes,
  documentController.replace.bind(documentController)
);

router.delete(
  '/:id',
  requireRole('hr_admin'),
  documentController.delete.bind(documentController)
);

export default router;
