import { env } from '../../config/env.js';

const DEFAULT_SITE_URL = 'https://esadar.com.uy';

const CANONICAL_HOSTS = new Map([
  ['sandbox.esadar.com.uy', 'https://sandbox.esadar.com.uy'],
  ['esadar.com.uy', 'https://esadar.com.uy'],
  ['www.esadar.com.uy', 'https://esadar.com.uy'],
]);

function isLocalHostname(hostname = '') {
  return ['localhost', '127.0.0.1', '::1'].includes(String(hostname).toLowerCase());
}

function toUrlCandidate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) return raw;

  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(raw)) {
    return `http://${raw}`;
  }

  if (/^(sandbox\.)?esadar\.com\.uy(\/.*)?$/i.test(raw) || /^www\.esadar\.com\.uy(\/.*)?$/i.test(raw)) {
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

    if (CANONICAL_HOSTS.has(hostname)) {
      return CANONICAL_HOSTS.get(hostname);
    }

    if (isLocalHostname(hostname)) {
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
    DEFAULT_SITE_URL,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeMailSiteUrl(candidate);
    if (normalized) return normalized;
  }

  return DEFAULT_SITE_URL;
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
