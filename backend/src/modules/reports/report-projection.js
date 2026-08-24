const FORBIDDEN_REPORT_COLUMN_PATTERN = /email|phone|postal|address|instagram|session|token|credential|secret|password|provider(?:id|reference|data|json)|mercadopago|webhook|auth(?:id|identifier)/i;

function normalizeColumn(column) {
  if (!column || typeof column !== 'object') {
    throw new TypeError('Report columns must be explicit objects.');
  }

  const key = String(column.key || '').trim();
  const header = String(column.header || '').trim();
  if (!key || !header) {
    throw new TypeError('Every report column requires a key and header.');
  }
  if (FORBIDDEN_REPORT_COLUMN_PATTERN.test(key)) {
    throw new TypeError(`Forbidden canonical report column: ${key}`);
  }

  return {
    key,
    header,
    ...(column.type ? { type: column.type } : {}),
    ...(column.width ? { width: column.width } : {}),
  };
}

function pickAllowedCells(row, columns) {
  return Object.fromEntries(columns.map(({ key }) => [key, normalizeAllowedValue(row?.[key])]));
}

function normalizeAllowedValue(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (Array.isArray(value)) {
    return value.filter((item) => ['string', 'number', 'boolean'].includes(typeof item));
  }
  if (typeof value === 'object') return null;
  return value;
}

function sanitizeSupplementalObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    if (FORBIDDEN_REPORT_COLUMN_PATTERN.test(key)) return [];
    if (item && typeof item === 'object' && !Array.isArray(item) && !(item instanceof Date)) {
      return [[key, sanitizeSupplementalObject(item)]];
    }
    return [[key, normalizeAllowedValue(item)]];
  }));
}

export function createReportProjection({
  columns,
  rows = [],
  totalRow = null,
  summary = {},
  metadata = {},
} = {}) {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new TypeError('A canonical report requires an explicit column allowlist.');
  }

  const normalizedColumns = columns.map(normalizeColumn);
  const keys = normalizedColumns.map(({ key }) => key);
  const headers = normalizedColumns.map(({ header }) => header);
  if (new Set(keys).size !== keys.length || new Set(headers).size !== headers.length) {
    throw new TypeError('Canonical report column keys and headers must be unique.');
  }

  return {
    columns: normalizedColumns,
    rows: (Array.isArray(rows) ? rows : []).map((row) => pickAllowedCells(row, normalizedColumns)),
    totalRow: totalRow == null ? null : pickAllowedCells(totalRow, normalizedColumns),
    summary: sanitizeSupplementalObject(summary),
    metadata: sanitizeSupplementalObject(metadata),
  };
}

export function sumReportNumericField(rows, key, { decimalPlaces = null } = {}) {
  const total = (rows || []).reduce((sum, row) => {
    const value = Number(row?.[key] ?? 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  return Number.isInteger(decimalPlaces) ? Number(total.toFixed(decimalPlaces)) : total;
}

export function calculateReportAggregatePercentage(numerator, denominator) {
  const safeNumerator = Number(numerator ?? 0);
  const safeDenominator = Number(denominator ?? 0);
  if (!Number.isFinite(safeNumerator)
    || !Number.isFinite(safeDenominator)
    || safeDenominator <= 0) return 0;
  return Number(((safeNumerator / safeDenominator) * 100).toFixed(2));
}

export function isForbiddenReportColumnKey(key) {
  return FORBIDDEN_REPORT_COLUMN_PATTERN.test(String(key || ''));
}
