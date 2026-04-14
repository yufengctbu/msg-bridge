import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export interface AppError extends Error {
  status?: number;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status = err.status ?? 500;
  console.error(`[error] ${err.message}`, err.stack);
  res.status(status).json({
    error: config.server.env === 'production' ? 'Internal Server Error' : err.message,
  });
}
