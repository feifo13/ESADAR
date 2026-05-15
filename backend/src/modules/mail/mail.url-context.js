import { env } from '../../config/env.js';

function isLocalHostname(hostname = '') {
  const normalized = String(hostname).toLowerCase().replace(/^\[|\]$/g, '');
  return ['localhost', '127.0.0.1', '::1'].includes(normalized);
}

function isIpHostname(hostname = '') {
  const normalized = String(hostname).toLowerCase().replace(/^\[|\]$/g, '');
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(normalized) || normalized.includes(':');
}

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

function normalizeMailSiteUrl(value) {
  const candidate = toUrlCandidate(value);
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.toLowerCase();

    if (isLocalHostname(hostname) || !isIpHostname(hostname)) {
      return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, '');
    }
  } catch {
    return null;
  }

  return null;
}

export function resolveMailSiteUrl(...values) {
  const flattened = values.flat().filter(Boolean);
  const candidates = [
    ...flattened,
    env.publicSiteUrl,
    env.appOrigin,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeMailSiteUrl(candidate);
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
