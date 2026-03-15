import { verifyAccessToken } from '../utils/jwt.js';
import { unauthorized } from '../utils/app-error.js';

function extractToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim();
}

export function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  if (!token) return next();

  try {
    req.auth = verifyAccessToken(token);
    return next();
  } catch (_error) {
    return next();
  }
}

export function requireAuth(req, _res, next) {
  const token = extractToken(req);
  if (!token) return next(unauthorized('Missing access token'));

  try {
    req.auth = verifyAccessToken(token);
    return next();
  } catch (_error) {
    return next(unauthorized('Invalid or expired access token'));
  }
}
