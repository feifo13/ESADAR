const ENV_SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL || '').replace(/\/$/, '');

function isLocalHostname(hostname = '') {
  const normalized = String(hostname).toLowerCase().replace(/^\[|\]$/g, '');
  return ['localhost', '127.0.0.1', '::1'].includes(normalized);
}

function isIpHostname(hostname = '') {
  const normalized = String(hostname).toLowerCase().replace(/^\[|\]$/g, '');
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(normalized) || normalized.includes(':');
}

export function isUnsafePublicUrl(value) {
  if (!value || !/^https?:\/\//i.test(String(value))) return false;

  try {
    const parsed = new URL(value);
    return isIpHostname(parsed.hostname) && !isLocalHostname(parsed.hostname);
  } catch {
    return false;
  }
}

export function sanitizePublicUrl(value) {
  const raw = String(value || '').trim();
  if (!raw || isUnsafePublicUrl(raw)) return '';
  return raw.replace(/\/$/, '');
}

function getBrowserOrigin() {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  try {
    const parsed = new URL(origin);
    if (isIpHostname(parsed.hostname) && !isLocalHostname(parsed.hostname)) {
      return '';
    }
    return origin;
  } catch {
    return '';
  }
}

export function getSiteUrl(site) {
  return (
    sanitizePublicUrl(site?.url) ||
    sanitizePublicUrl(ENV_SITE_URL) ||
    getBrowserOrigin()
  );
}

export function toAbsoluteUrl(path, site) {
  if (!path) return '';
  const normalized = String(path).trim();
  if (/^(https?:|data:|blob:)/i.test(normalized)) return sanitizePublicUrl(normalized) || '';
  const baseUrl = getSiteUrl(site);
  return `${baseUrl}${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
}

export function buildOrganizationJsonLd(site) {
  const siteUrl = getSiteUrl(site);
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site?.name || 'ESADAR',
    url: siteUrl,
    description: site?.description || '',
  };
}

export function buildWebsiteJsonLd(site) {
  const siteUrl = getSiteUrl(site);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site?.name || 'ESADAR',
    url: siteUrl,
    description: site?.description || '',
  };
}

export function buildProductJsonLd(article, site) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: article?.seoTitle || article?.title,
    description: article?.seoDescription || article?.description || '',
    image: (article?.images || []).map((image) => (
      toAbsoluteUrl(image.detailFilePath || image.filePath, site)
    )),
    sku: article?.internalCode || String(article?.id || ''),
    brand: article?.brandName ? { '@type': 'Brand', name: article.brandName } : undefined,
    category: article?.categoryName || article?.category?.name || undefined,
    color: article?.color || undefined,
    material: article?.material || undefined,
    offers: {
      '@type': 'Offer',
      price: Number(article?.discountedPrice ?? article?.salePrice ?? 0),
      priceCurrency: 'UYU',
      availability: Number(article?.quantityAvailable || 0) > 0 &&
        (article?.publicationStatus || article?.status) === 'ACTIVE'
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: sanitizePublicUrl(article?.canonicalUrl) || toAbsoluteUrl(`/articles/${article?.slug || article?.id}`, site),
      itemCondition: 'https://schema.org/UsedCondition',
    },
  };
}

export function buildBreadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
