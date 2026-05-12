import { env } from '../../../config/env.js';

const DEFAULT_SITE_URL = 'https://esadar.com';

function getSiteBaseUrl() {
  return String(env.publicSiteUrl || DEFAULT_SITE_URL).replace(/\/+$/, '');
}

export function buildPublicUrl(path = '/') {
  const rawPath = String(path || '/').trim();
  if (/^https?:\/\//i.test(rawPath)) return rawPath;
  const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  return `${getSiteBaseUrl()}${normalizedPath}`.replace(/([^:]\/)\/+/, '$1');
}

export function buildOrderUrl(order = {}) {
  return buildPublicUrl(order?.id ? `/cuenta/ordenes/${order.id}` : '/cuenta/ordenes');
}

export function buildArticleUrl(article = {}) {
  const slugOrId = article?.slug || article?.id || article?.articleId || '';
  return buildPublicUrl(slugOrId ? `/articles/${slugOrId}` : '/articles');
}

export function buildLoginUrl() {
  return buildPublicUrl('/login');
}

export function buildAccountUrl() {
  return buildPublicUrl('/cuenta');
}

export function buildResetPasswordUrl(tokenOrUrl = '') {
  const raw = String(tokenOrUrl || '').trim();
  if (!raw) return buildLoginUrl();
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/reset-password')) return buildPublicUrl(raw);
  if (raw.startsWith('reset-password')) return buildPublicUrl(`/${raw}`);
  return buildPublicUrl(`/reset-password?token=${encodeURIComponent(raw)}`);
}
