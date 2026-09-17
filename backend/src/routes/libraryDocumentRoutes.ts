import { Router } from 'express';
import libraryDocumentController from '../controllers/libraryDocumentController';
import { authenticate, requireRole } from '../middleware/auth';
import { uploadFile, validateMagicBytes } from '../middleware/upload';

const router = Router();

// List documents (accessible to hr_admin, manager, and employee with role-based scoping)
router.get('/', authenticate, (req, res, next) => libraryDocumentController.list(req, res, next));

// Download/view document file stream
router.get('/:id/download', authenticate, (req, res, next) => libraryDocumentController.download(req, res, next));

// Get single document metadata
router.get('/:id', authenticate, (req, res, next) => libraryDocumentController.getOne(req, res, next));

// Upload new library document (HR Admin or Manager)
router.post(
  '/',
  uploadFile('file'),
  requireRole('hr_admin', 'manager'),
  validateMagicBytes,
  (req, res, next) => libraryDocumentController.upload(req, res, next)
);

// Replace existing document file (HR Admin or Manager)
router.put(
  '/:id',
  uploadFile('file'),
  requireRole('hr_admin', 'manager'),
  validateMagicBytes,
  (req, res, next) => libraryDocumentController.replace(req, res, next)
);

// Delete document (HR Admin or Manager)
router.delete(
  '/:id',
  authenticate,
  requireRole('hr_admin', 'manager'),
  (req, res, next) => libraryDocumentController.delete(req, res, next)
);

export default router;
