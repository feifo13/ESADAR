import { updateCollectingSettingsSchema } from './collecting.schemas.js';
import { getCollectingSettings, updateCollectingSettings } from './collecting.service.js';

function getAuditContext(req) {
  return {
    actorUserId: req.auth?.userId || null,
    actorLabel: req.auth?.email || null,
    source: req.auditSource,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] || null,
  };
}

function sanitizeCollectingSettings(settings) {
  return {
    ...settings,
    mercadoPagoAccessToken: '',
    mercadoPagoAccessTokenConfigured: Boolean(settings?.mercadoPagoAccessToken),
    mercadoPagoWebhookSecret: '',
    mercadoPagoWebhookSecretConfigured: Boolean(settings?.mercadoPagoWebhookSecret),
  };
}

export async function getAdminCollectingSettings(_req, res) {
  const settings = await getCollectingSettings();
  return res.json({ ok: true, settings: sanitizeCollectingSettings(settings) });
}

export async function updateAdminCollectingSettings(req, res) {
  const input = updateCollectingSettingsSchema.parse(req.body);
  const settings = await updateCollectingSettings(input, getAuditContext(req));
  return res.json({ ok: true, settings: sanitizeCollectingSettings(settings) });
}
