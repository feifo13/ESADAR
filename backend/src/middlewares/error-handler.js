import { ZodError } from 'zod';
import { AppError } from '../utils/app-error.js';

export function notFoundHandler(req, res) {
  return res.status(404).json({
    ok: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    requestId: req.requestId,
  });
}

export function errorHandler(error, req, res, _next) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      ok: false,
      message: 'Validation error',
      details: error.flatten(),
      requestId: req.requestId,
    });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      ok: false,
      message: error.message,
      details: error.details,
      requestId: req.requestId,
    });
  }

  console.error(`[${req.requestId}]`, error);
  return res.status(500).json({
    ok: false,
    message: 'Internal server error',
    requestId: req.requestId,
  });
}
