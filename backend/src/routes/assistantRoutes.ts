/**
 * Assistant Route Definitions.
 *
 * Exposes /assistant endpoints.
 * Requires JWT authentication. Available to all authenticated company roles (employee, manager, hr_admin).
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import assistantController from '../controllers/assistantController';

const router = Router();

// All assistant routes require authentication
router.use(authenticate);

// POST /assistant/chat - Query Qorra AI assistant
router.post('/chat', (req, res, next) => {
  assistantController.chat(req, res, next);
});

export default router;
