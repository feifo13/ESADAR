const ENV_SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL || '').replace(/\/$/, '');

export function getSiteUrl(site) {
  if (site?.url) return String(site.url).replace(/\/$/, '');
  if (ENV_SITE_URL) return ENV_SITE_URL;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

export function toAbsoluteUrl(path, site) {
  if (!path) return '';
  const normalized = String(path).trim();
  if (/^(https?:|data:|blob:)/i.test(normalized)) return normalized;
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
      availability: Number(article?.quantityAvailable || 0) > 0 && article?.status === 'ACTIVE'
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: article?.canonicalUrl || toAbsoluteUrl(`/articles/${article?.slug || article?.id}`, site),
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
