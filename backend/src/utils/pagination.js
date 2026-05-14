import { normalizeSqlLimit, normalizeSqlOffset } from './sql-safety.js';

function normalizePositiveInt(value, fallback, max = 10000) {
  return normalizeSqlLimit(value, fallback, max);
}

export function getPagination(query, defaults = {}) {
  const maxPage = normalizePositiveInt(defaults.maxPage, 10000, 100000);
  const maxPageSize = normalizeSqlLimit(defaults.maxPageSize ?? 100, 100, 500);
  const defaultPage = normalizePositiveInt(defaults.page, 1, maxPage);
  const defaultPageSize = normalizeSqlLimit(defaults.pageSize ?? 20, 20, maxPageSize);

  const page = normalizePositiveInt(query.page, defaultPage, maxPage);
  const pageSize = normalizeSqlLimit(query.pageSize, defaultPageSize, maxPageSize);
  const offset = normalizeSqlOffset((page - 1) * pageSize);

  return { page, pageSize, offset, limit: pageSize };
}
