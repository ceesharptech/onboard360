import { Router } from 'express';
import employeeController from '../controllers/employeeController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// List employees (authenticated: HR Admin company-wide, Manager own department, Employee own record)
router.get('/', authenticate, (req, res, next) => employeeController.list(req, res, next));

// Manager assigned tasks
router.get(
  '/manager/assigned-tasks',
  authenticate,
  requireRole('manager'),
  (req, res, next) => employeeController.getMyManagerTasks(req, res, next)
);

// Mentor assigned mentees and tasks
router.get(
  '/mentor/my-mentees',
  authenticate,
  (req, res, next) => employeeController.getMyMentees(req, res, next)
);

// Create employee (HR Admin only)
router.post(
  '/',
  authenticate,
  requireRole('hr_admin'),
  (req, res, next) => employeeController.create(req, res, next)
);

// Get single employee
router.get('/:id', authenticate, (req, res, next) => employeeController.getOne(req, res, next));

// Update employee (HR Admin or Manager)
router.put(
  '/:id',
  authenticate,
  requireRole('hr_admin', 'manager'),
  (req, res, next) => employeeController.update(req, res, next)
);

// Update task completion or assignment
router.patch(
  '/:id/tasks/:taskId',
  authenticate,
  (req, res, next) => employeeController.updateTask(req, res, next)
);

// Get employee progress stats
router.get(
  '/:id/progress',
  authenticate,
  (req, res, next) => employeeController.getProgress(req, res, next)
);

export default router;
