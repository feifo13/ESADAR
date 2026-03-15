export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function badRequest(message, details = null) {
  return new AppError(message, 400, details);
}

export function unauthorized(message = 'Unauthorized') {
  return new AppError(message, 401);
}

export function forbidden(message = 'Forbidden') {
  return new AppError(message, 403);
}

export function notFound(message = 'Not found') {
  return new AppError(message, 404);
}
