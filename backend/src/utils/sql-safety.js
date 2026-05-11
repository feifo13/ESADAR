import { badRequest } from './app-error.js';

export function normalizeSqlLimit(value, fallback = 25, max = 100) {
  const numeric = Number(value ?? fallback);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.min(max, Math.floor(numeric));
}

export function normalizeSqlOffset(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.floor(numeric);
}


export function buildSqlLimitClause(value, fallback = 25, max = 100) {
  return `LIMIT ${normalizeSqlLimit(value, fallback, max)}`;
}

export function buildSqlLimitOffsetClause(limit, offset, fallback = 25, max = 100) {
  return `LIMIT ${normalizeSqlLimit(limit, fallback, max)} OFFSET ${normalizeSqlOffset(offset)}`;
}

export function buildSqlPlaceholders(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw badRequest('La lista de valores para la consulta es invalida.');
  }
  return values.map(() => '?').join(',');
}

export function resolveAllowedSqlIdentifier(value, allowedMap, label = 'identificador SQL') {
  const resolved = allowedMap?.[value];
  if (!resolved) {
    throw badRequest(`${label} no permitido.`);
  }
  return resolved;
}
