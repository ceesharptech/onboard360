import { Request, Response, NextFunction } from 'express';
import { trainingService } from '../services/trainingService';
import {
  createTrainingEntrySchema,
  updateTrainingEntrySchema,
  trainingListQuerySchema,
} from '../utils/validation';

export class TrainingController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = createTrainingEntrySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid input data',
            details: parsed.error.issues,
          },
        });
        return;
      }

      const entry = await trainingService.createTrainingEntry(
        req.user!.companyId,
        req.user!.userId,
        parsed.data
      );

      res.status(201).json({
        status: 'ok',
        data: entry,
      });
    } catch (err: any) {
      if (
        err.message?.includes('YouTube') ||
        err.message?.includes('guideContent') ||
        err.message?.includes('Invalid')
      ) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: err.message,
          },
        });
        return;
      }
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = trainingListQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid query parameters',
          },
        });
        return;
      }

      const result = await trainingService.listTrainingEntries(
        req.user!.companyId,
        parsed.data
      );

      res.status(200).json({
        status: 'ok',
        data: result.data,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const entry = await trainingService.getTrainingEntry(req.user!.companyId, id);

      if (!entry) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Training entry not found',
          },
        });
        return;
      }

      res.status(200).json({
        status: 'ok',
        data: entry,
      });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const parsed = updateTrainingEntrySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message || 'Invalid input data',
            details: parsed.error.issues,
          },
        });
        return;
      }

      const updated = await trainingService.updateTrainingEntry(
        req.user!.companyId,
        id,
        parsed.data
      );

      if (!updated) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Training entry not found',
          },
        });
        return;
      }

      res.status(200).json({
        status: 'ok',
        data: updated,
      });
    } catch (err: any) {
      if (
        err.message?.includes('YouTube') ||
        err.message?.includes('guideContent') ||
        err.message?.includes('Invalid')
      ) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: err.message,
          },
        });
        return;
      }
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const deleted = await trainingService.deleteTrainingEntry(req.user!.companyId, id);

      if (!deleted) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Training entry not found',
          },
        });
        return;
      }

      res.status(200).json({
        status: 'ok',
        message: 'Training entry deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }
}

export const trainingController = new TrainingController();
export default trainingController;
