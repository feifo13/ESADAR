export function articleSlugOrId(value, fallback = '') {
  if (value && typeof value === 'object') {
    return (
      value.slug ||
      value.articleSlug ||
      value.articleId ||
      value.id ||
      fallback ||
      ''
    );
  }

  return value || fallback || '';
}

export function articlePath(value, fallback = '') {
  const target = articleSlugOrId(value, fallback);
  if (target === null || target === undefined || target === '') return '/articles';
  return `/articles/${encodeURIComponent(String(target))}`;
}

export function articleOfferPath(value, fallback = '') {
  return `${articlePath(value, fallback)}/offer`;
}
