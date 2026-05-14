import { randomUUID } from 'node:crypto';
import { resolveMailSiteUrlFromRequest } from '../modules/mail/mail.url-context.js';

function inferSource(pathname) {
  if (pathname.startsWith('/api/admin')) return 'BACKOFFICE';
  if (pathname.startsWith('/api/public')) return 'FRONTEND';
  if (pathname.startsWith('/api/auth')) return 'FRONTEND';
  return 'API';
}

export function requestContext(req, _res, next) {
  req.requestId = randomUUID();
  req.auditSource = inferSource(req.path);
  req.publicSiteUrl = resolveMailSiteUrlFromRequest(req);
  next();
}
