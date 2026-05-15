import { ZodError } from 'zod';
import { AppError } from '../utils/app-error.js';
import { env } from '../config/env.js';

export function notFoundHandler(req, res) {
  return res.status(404).json({
    ok: false,
    message: 'Route not found',
    requestId: req.requestId,
  });
}

export function errorHandler(error, req, res, _next) {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({
      ok: false,
      message: 'Invalid JSON body',
      requestId: req.requestId,
    });
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      ok: false,
      message: 'Validation error',
      details: error.flatten(),
      requestId: req.requestId,
    });
  }

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      console.error(`[${req.requestId}]`, error);
    }

    return res.status(error.statusCode).json({
      ok: false,
      message: env.isProduction && error.statusCode >= 500
        ? 'Internal server error'
        : error.message,
      details: env.isProduction && error.statusCode >= 500
        ? null
        : error.details,
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
