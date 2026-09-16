import { Router } from 'express';
import departmentController from '../controllers/departmentController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// List departments (accessible to all authenticated users)
router.get('/', authenticate, (req, res, next) => departmentController.list(req, res, next));

// Create department (HR Admin only)
router.post(
  '/',
  authenticate,
  requireRole('hr_admin'),
  (req, res, next) => departmentController.create(req, res, next)
);

// Get single department (accessible to all authenticated users)
router.get('/:id', authenticate, (req, res, next) => departmentController.getById(req, res, next));

// Update department (HR Admin only)
router.patch(
  '/:id',
  authenticate,
  requireRole('hr_admin'),
  (req, res, next) => departmentController.update(req, res, next)
);
router.put(
  '/:id',
  authenticate,
  requireRole('hr_admin'),
  (req, res, next) => departmentController.update(req, res, next)
);

// Delete department (HR Admin only)
router.delete(
  '/:id',
  authenticate,
  requireRole('hr_admin'),
  (req, res, next) => departmentController.delete(req, res, next)
);

// Mentor pool routes (accessible to HR Admin and Managers)
router.get(
  '/:id/mentors',
  authenticate,
  requireRole('hr_admin', 'manager'),
  (req, res, next) => departmentController.getMentors(req, res, next)
);

router.post(
  '/:id/mentors',
  authenticate,
  requireRole('hr_admin', 'manager'),
  (req, res, next) => departmentController.addMentor(req, res, next)
);

router.delete(
  '/:id/mentors/:mentorId',
  authenticate,
  requireRole('hr_admin', 'manager'),
  (req, res, next) => departmentController.removeMentor(req, res, next)
);

export default router;
