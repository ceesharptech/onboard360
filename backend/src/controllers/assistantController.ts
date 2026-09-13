/**
 * Assistant Controller.
 *
 * Exposes the Qorra AI Company Assistant chat endpoint.
 * Validates question payload and scopes query execution strictly to req.user.companyId.
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import assistantService from '../services/assistantService';
import { BadRequestError } from '../utils/errors';

const chatSchema = z.object({
  question: z
    .string({ required_error: 'Question is required' })
    .trim()
    .min(1, 'Question cannot be empty')
    .max(1000, 'Question must not exceed 1000 characters'),
});

export class AssistantController {
  async chat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parseResult = chatSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new BadRequestError(
          parseResult.error.errors.map((e) => e.message).join(', ')
        );
      }

      const { question } = parseResult.data;
      const companyId = req.user!.companyId;

      const result = await assistantService.askQuestion({
        companyId,
        question,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

export default new AssistantController();
