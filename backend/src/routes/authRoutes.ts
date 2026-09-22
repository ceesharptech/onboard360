import { Router } from 'express';
import { authController } from '../controllers/authController';
import { loginLimiter } from '../middleware/rateLimiter';

const router = Router();

// Public auth endpoints
router.post('/login', loginLimiter, (req, res, next) => authController.login(req, res, next));
router.post('/change-password', loginLimiter, (req, res, next) => authController.changePassword(req, res, next));
router.post('/refresh', (req, res, next) => authController.refresh(req, res, next));
router.post('/logout', (req, res, next) => authController.logout(req, res, next));
router.get('/me', (req, res, next) => authController.getMe(req, res, next));

export default router;
