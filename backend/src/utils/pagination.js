export function getPagination(query, defaults = {}) {
  const rawPage = Number(query.page ?? defaults.page ?? 1);
  const rawPageSize = Number(query.pageSize ?? defaults.pageSize ?? 20);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0
    ? Math.min(100, Math.floor(rawPageSize))
    : 20;
  const offset = (page - 1) * pageSize;

  return { page, pageSize, offset, limit: pageSize };
}
