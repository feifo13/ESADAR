import { badRequest } from './app-error.js';

function parseStrictInteger(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Math.trunc(value);
  }

  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return null;

  const numeric = Number(text);
  return Number.isSafeInteger(numeric) ? numeric : null;
}

export function normalizeSqlLimit(value, fallback = 25, max = 100) {
  const numeric = parseStrictInteger(value ?? fallback);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.min(max, Math.floor(numeric));
}

export function normalizeSqlOffset(value, max = 1_000_000) {
  const numeric = parseStrictInteger(value ?? 0);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.min(max, Math.floor(numeric));
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
