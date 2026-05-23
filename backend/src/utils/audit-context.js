export function getAuditContext(req) {
  return {
    actorUserId: req.auth?.userId || null,
    actorLabel: req.auth?.email || null,
    source: req.auditSource || 'API',
    ipAddress: req.ip || null,
    userAgent: req.headers?.['user-agent'] || null,
    publicSiteUrl: req.publicSiteUrl || null,
  };
}
