import { env } from '../../config/env.js';

function toUrlCandidate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) return raw;

  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(raw)) {
    return `http://${raw}`;
  }

  if (/^[a-z0-9.-]+(?::\d+)?(\/.*)?$/i.test(raw)) {
    return `https://${raw}`;
  }

  return null;
}

function normalizeOrigin(value) {
  const candidate = toUrlCandidate(value);
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.origin.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function getAllowedMailSiteOrigins() {
  return new Set(
    (env.mail.allowedSiteOrigins || [])
      .map(normalizeOrigin)
      .filter(Boolean),
  );
}

function normalizeAllowedMailSiteUrl(value) {
  const normalized = normalizeOrigin(value);
  if (!normalized) return null;

  const allowedOrigins = getAllowedMailSiteOrigins();
  return allowedOrigins.has(normalized) ? normalized : null;
}

export function resolveMailSiteUrl(...values) {
  const flattened = values.flat().filter(Boolean);
  const candidates = [
    ...flattened,
    env.publicSiteUrl,
    env.appOrigin,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeAllowedMailSiteUrl(candidate);
    if (normalized) return normalized;
  }

  return '';
}

export function resolveMailSiteUrlFromRequest(req) {
  const headers = req?.headers || {};
  const forwardedProto = String(headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const forwardedHost = String(headers['x-forwarded-host'] || headers.host || '').split(',')[0].trim();
  const proxyOrigin = forwardedHost ? `${forwardedProto || req?.protocol || 'https'}://${forwardedHost}` : null;

  return resolveMailSiteUrl(
    headers.origin,
    headers.referer || headers.referrer,
    proxyOrigin,
  );
}
