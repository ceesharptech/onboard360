import { Router } from 'express';
import { platformAdminController } from '../controllers/platformAdminController';
import { requirePlatformAdmin } from '../middleware/platformAdminAuth';
import { loginLimiter } from '../middleware/rateLimiter';

const router = Router();

// Platform Admin Auth (Isolated from tenant /auth/login)
router.post('/auth/login', loginLimiter, (req, res, next) =>
  platformAdminController.login(req, res, next)
);

router.get('/auth/me', requirePlatformAdmin, (req, res, next) =>
  platformAdminController.getMe(req, res, next)
);

// Company Onboarding & Platform Management (Requires platform admin token)
router.post('/companies', requirePlatformAdmin, (req, res, next) =>
  platformAdminController.createCompany(req, res, next)
);

router.get('/companies', requirePlatformAdmin, (req, res, next) =>
  platformAdminController.listCompanies(req, res, next)
);

router.get('/companies/:id', requirePlatformAdmin, (req, res, next) =>
  platformAdminController.getCompany(req, res, next)
);

export default router;
