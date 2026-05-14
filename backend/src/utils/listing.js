import { z } from 'zod';

export function emptyToUndefined(value) {
  if (value == null) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

export const optionalTrimmedString = (max = 150) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

export const optionalPositiveInt = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().positive().optional(),
);

export const optionalEnum = (values) =>
  z.preprocess(emptyToUndefined, z.enum(values).optional());

export const optionalSortField = (values) =>
  z.preprocess((value) => {
    const normalized = emptyToUndefined(value);
    if (normalized === undefined) return undefined;

    const text = String(normalized).trim();
    return values.includes(text) ? text : undefined;
  }, z.enum(values).optional());

export const sortFieldSchema = (values, defaultValue = values[0]) =>
  z.preprocess((value) => {
    const normalized = emptyToUndefined(value);
    if (normalized === undefined) return defaultValue;

    const text = String(normalized).trim();
    return values.includes(text) ? text : defaultValue;
  }, z.enum(values).default(defaultValue));

export const optionalBooleanish = z.preprocess((value) => {
  if (value == null || value === '') return undefined;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'si', 'sí', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return value;
}, z.boolean().optional());

export const optionalDateString = z.preprocess(
  emptyToUndefined,
  z.string().date().optional(),
);

export const sortDirSchema = z.preprocess((value) => {
  if (value == null || String(value).trim() === '') return undefined;
  const normalized = String(value).trim().toLowerCase();
  return ['asc', 'desc'].includes(normalized) ? normalized : undefined;
}, z.enum(['asc', 'desc']).default('desc'));

export const pageSchema = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().min(1).max(10000).default(1),
);

export const pageSizeSchema = (defaultSize = 25) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(1).max(100).default(defaultSize),
  );

export function buildLikeValue(term) {
  return `%${String(term || '').trim()}%`;
}

export function appendDateRangeFilters(columnName, filters, clauses, params) {
  if (filters.dateFrom) {
    clauses.push(`DATE(${columnName}) >= ?`);
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    clauses.push(`DATE(${columnName}) <= ?`);
    params.push(filters.dateTo);
  }
}

export function resolveSortClause({ sortBy, sortDir, sortMap, fallbackKey }) {
  const selectedKey = sortMap?.[sortBy] ? sortBy : fallbackKey;
  const direction = sortDir === 'asc' ? 'ASC' : 'DESC';
  const fallback = sortMap?.[selectedKey] || sortMap?.[Object.keys(sortMap || {})[0]];
  if (!fallback) {
    throw new Error('resolveSortClause requires at least one allowed sort field');
  }
  return fallback(direction);
}
