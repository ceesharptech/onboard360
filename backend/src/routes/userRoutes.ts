import { Router } from 'express';
import { userController } from '../controllers/userController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Protected: List users in company
router.get(
  '/',
  authenticate,
  (req, res, next) => userController.listUsers(req, res, next)
);

// Protected: Only HR Admins can create new user accounts
router.post(
  '/',
  authenticate,
  requireRole('hr_admin'),
  (req, res, next) => userController.createUser(req, res, next)
);

export default router;
