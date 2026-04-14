import type { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { sendFail } from '../utils/response';
import { HttpStatus } from '../utils/httpStatus';

export interface AppError extends Error {
  status?: number;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status = err.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
  console.error(`[error] ${err.message}`, err.stack);
  const message = config.server.env === 'production' ? 'Internal Server Error' : err.message;
  sendFail(res, message, status);
}
