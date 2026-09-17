/**
 * Analytics Routes.
 *
 * Implements RBAC per architecture.md:
 * - authenticate middleware ensures valid JWT
 * - requireRole('hr_admin', 'manager') restricts access
 */

import { Router } from 'express';
import analyticsController from '../controllers/analyticsController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.get(
  '/',
  authenticate,
  requireRole('hr_admin', 'manager'),
  (req, res, next) => analyticsController.getAnalytics(req, res, next)
);

export default router;
