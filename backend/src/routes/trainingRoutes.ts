import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { trainingController } from '../controllers/trainingController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Public read access for all authenticated company members
router.get('/', (req, res, next) => trainingController.list(req, res, next));
router.get('/:id', (req, res, next) => trainingController.getOne(req, res, next));

// Write access strictly restricted to HR Admin
router.post('/', requireRole('hr_admin'), (req, res, next) => trainingController.create(req, res, next));
router.put('/:id', requireRole('hr_admin'), (req, res, next) => trainingController.update(req, res, next));
router.delete('/:id', requireRole('hr_admin'), (req, res, next) => trainingController.delete(req, res, next));

export default router;
