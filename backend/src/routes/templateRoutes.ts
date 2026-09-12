import { Router } from 'express';
import templateController from '../controllers/templateController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// List templates (all authenticated users can list templates, manager filtered to their department)
router.get('/', authenticate, (req, res, next) => templateController.list(req, res, next));

// Create template (HR Admin or Manager)
router.post(
  '/',
  authenticate,
  requireRole('hr_admin', 'manager'),
  (req, res, next) => templateController.create(req, res, next)
);

// Get single template
router.get('/:id', authenticate, (req, res, next) => templateController.getOne(req, res, next));

// Update template
router.put(
  '/:id',
  authenticate,
  requireRole('hr_admin', 'manager'),
  (req, res, next) => templateController.update(req, res, next)
);

// Reorder template tasks
router.put(
  '/:id/reorder',
  authenticate,
  requireRole('hr_admin', 'manager'),
  (req, res, next) => templateController.reorderTasks(req, res, next)
);

// Delete template
router.delete(
  '/:id',
  authenticate,
  requireRole('hr_admin', 'manager'),
  (req, res, next) => templateController.delete(req, res, next)
);

export default router;
