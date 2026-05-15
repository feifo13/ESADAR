import { env } from '../../config/env.js';
import { joinPublicSiteUrl, sanitizePublicUrl } from '../../utils/assets.js';

function trimToLength(value, max) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1)).trim()}…`;
}

export function buildArticleSeoTitle(article) {
  if (article?.seoTitle) {
    return trimToLength(article.seoTitle, 255);
  }

  const parts = [
    article?.title,
    article?.brandName || article?.brand?.name,
    article?.categoryName || article?.category?.name,
    env.storeName,
  ].filter(Boolean);

  return trimToLength(parts.join(' | '), 255);
}

export function buildArticleSeoDescription(article) {
  if (article?.seoDescription) {
    return trimToLength(article.seoDescription, 500);
  }

  const fragments = [
    article?.description,
    article?.categoryName || article?.category?.name ? `Categoría ${article.categoryName || article.category?.name}.` : '',
    article?.brandName || article?.brand?.name ? `Marca ${article.brandName || article.brand?.name}.` : '',
    article?.sizeText || article?.sizeCode || article?.size?.code ? `Talle ${article.sizeText || article.sizeCode || article.size?.code}.` : '',
    article?.conditionLabel ? `Estado ${article.conditionLabel}.` : '',
  ].filter(Boolean);

  if (!fragments.length) {
    return trimToLength(env.storeDescription, 500);
  }

  return trimToLength(fragments.join(' '), 500);
}

export function buildArticleCanonicalUrl(article) {
  const storedCanonicalUrl = sanitizePublicUrl(article?.canonicalUrl);
  if (storedCanonicalUrl) {
    return storedCanonicalUrl;
  }

  return joinPublicSiteUrl(`/articles/${article?.slug || article?.id}`);
}

export function enrichArticleSeo(article) {
  return {
    ...article,
    seoTitle: buildArticleSeoTitle(article),
    seoDescription: buildArticleSeoDescription(article),
    canonicalUrl: buildArticleCanonicalUrl(article),
  };
}
