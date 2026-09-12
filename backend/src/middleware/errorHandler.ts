import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Centralized Express error handler.
 * Formats all errors into consistent shape: { error: { message, code } }.
 * Never leaks stack traces or raw database exceptions to clients.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const message = issue ? `${issue.path.join('.')}: ${issue.message}` : 'Validation error';
    res.status(400).json({
      error: {
        message,
        code: 'VALIDATION_ERROR',
      },
    });
    return;
  }

  // Handle known AppErrors (Unauthorized, Forbidden, NotFound, etc.)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
      },
    });
    return;
  }

  // Handle unexpected internal errors
  logger.error(
    {
      err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
      method: req.method,
      url: req.originalUrl,
    },
    'Unhandled server error'
  );

  res.status(500).json({
    error: {
      message: 'An internal server error occurred',
      code: 'INTERNAL_ERROR',
    },
  });
}
