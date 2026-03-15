import { randomUUID } from 'node:crypto';

function inferSource(pathname) {
  if (pathname.startsWith('/api/admin')) return 'BACKOFFICE';
  if (pathname.startsWith('/api/public')) return 'FRONTEND';
  if (pathname.startsWith('/api/auth')) return 'FRONTEND';
  return 'API';
}

export function requestContext(req, _res, next) {
  req.requestId = randomUUID();
  req.auditSource = inferSource(req.path);
  next();
}
