import { handleMercadoPagoWebhook } from './mercado-pago.webhook.service.js';

function getAuditContext(req) {
  return {
    actorUserId: null,
    actorLabel: 'Mercado Pago webhook',
    source: req.auditSource || 'API',
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || null,
  };
}

export async function receiveMercadoPagoWebhook(req, res) {
  const result = await handleMercadoPagoWebhook({
    payload: req.body || {},
    query: req.query || {},
    headers: req.headers || {},
    auditContext: getAuditContext(req),
  });

  return res.status(200).json({ ok: true, received: true, ...result });
}
