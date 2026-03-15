import { forbidden } from '../utils/app-error.js';

export function requireRole(...allowedRoles) {
  return function roleMiddleware(req, _res, next) {
    const roles = req.auth?.roles || [];
    const hasRole = allowedRoles.some((role) => roles.includes(role));
    if (!hasRole) {
      return next(forbidden('Insufficient permissions'));
    }
    return next();
  };
}
