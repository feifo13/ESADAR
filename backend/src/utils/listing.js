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
  return String(value).trim().toLowerCase();
}, z.enum(['asc', 'desc']).default('desc'));

export const pageSchema = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().min(1).default(1),
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
  const selectedKey = sortMap[sortBy] ? sortBy : fallbackKey;
  const direction = sortDir === 'asc' ? 'ASC' : 'DESC';
  return sortMap[selectedKey](direction);
}
