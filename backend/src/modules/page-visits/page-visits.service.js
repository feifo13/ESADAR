import { pool } from '../../db/pool.js';
import { badRequest } from '../../utils/app-error.js';

const ROUTES_BY_PAGE_TYPE = {
  HOME: ['/'],
  CATALOG: ['/articles'],
  PURCHASE_GUIDE: ['/guia-de-compra'],
  TERMS: ['/terminos-y-condiciones'],
  CONTACT: ['/contact'],
};

function normalizeRoute(route) {
  const raw = String(route || '').trim();
  if (!raw) return '';

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      return parsed.pathname || '/';
    } catch {
      return '';
    }
  }

  const path = raw.split(/[?#]/, 1)[0] || '';
  return path.startsWith('/') ? path : `/${path}`;
}

function assertPublicPageVisit(input) {
  const route = normalizeRoute(input.route);
  if (!route) {
    throw badRequest('Ruta pública inválida.');
  }

  if (input.pageType === 'ARTICLE_DETAIL') {
    if (!route.startsWith('/articles/') || !input.articleId) {
      throw badRequest('Ingreso de artículo inválido.');
    }
    return route;
  }

  const allowedRoutes = ROUTES_BY_PAGE_TYPE[input.pageType] || [];
  if (!allowedRoutes.includes(route)) {
    throw badRequest('Ingreso público no permitido.');
  }

  return route;
}

export async function recordPublicPageVisit(input) {
  const route = assertPublicPageVisit(input);

  await pool.execute(
    `
      INSERT INTO public_page_visits (
        page_type,
        route,
        article_id
      ) VALUES (?, ?, ?)
    `,
    [
      input.pageType,
      route,
      input.articleId || null,
    ],
  );

  return { recorded: true };
}
