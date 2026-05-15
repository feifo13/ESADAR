import { apiFetch } from './api.js';

export function trackPublicPageVisit({ pageType, route, articleId = null }) {
  if (!pageType || !route) return;

  void apiFetch('/api/public/page-visits', {
    method: 'POST',
    body: {
      pageType,
      route,
      articleId,
    },
  }).catch(() => undefined);
}
