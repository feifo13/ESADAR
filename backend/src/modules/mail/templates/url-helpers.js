import { resolveMailSiteUrl } from '../mail.url-context.js';

function getSiteBaseUrl(options = {}) {
  return resolveMailSiteUrl(
    options.publicSiteUrl,
    options.siteBaseUrl,
    options.origin,
    options.baseUrl,
  );
}

function normalizeInternalPath(path = '/') {
  const rawPath = String(path || '/').trim();

  if (/^https?:\/\//i.test(rawPath)) {
    try {
      const parsed = new URL(rawPath);
      return `${parsed.pathname || '/'}${parsed.search || ''}${parsed.hash || ''}`;
    } catch {
      return '/';
    }
  }

  return rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
}

export function buildPublicUrl(path = '/', options = {}) {
  const normalizedPath = normalizeInternalPath(path);
  return `${getSiteBaseUrl(options)}${normalizedPath}`.replace(/([^:]\/)\/+/, '$1');
}

export function buildOrderUrl(order = {}, options = {}) {
  return buildPublicUrl(order?.id ? `/cuenta/ordenes/${order.id}` : '/cuenta/ordenes', options);
}

export function buildArticleUrl(article = {}, options = {}) {
  const slugOrId = article?.slug || article?.id || article?.articleId || '';
  return buildPublicUrl(slugOrId ? `/articles/${slugOrId}` : '/articles', options);
}

export function buildLoginUrl(options = {}) {
  return buildPublicUrl('/login', options);
}

export function buildAccountUrl(options = {}) {
  return buildPublicUrl('/cuenta', options);
}

export function buildResetPasswordUrl(tokenOrUrl = '', options = {}) {
  const raw = String(tokenOrUrl || '').trim();
  if (!raw) return buildLoginUrl(options);

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      return buildPublicUrl(`${parsed.pathname || '/reset-password'}${parsed.search || ''}${parsed.hash || ''}`, options);
    } catch {
      return buildLoginUrl(options);
    }
  }

  if (raw.startsWith('/reset-password')) return buildPublicUrl(raw, options);
  if (raw.startsWith('reset-password')) return buildPublicUrl(`/${raw}`, options);
  return buildPublicUrl(`/reset-password?token=${encodeURIComponent(raw)}`, options);
}
