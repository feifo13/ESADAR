import { rowsToCsvBuffer, rowsToXlsxBuffer } from '../../utils/export-files.js';

function normalizeProjectionCell(value) {
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value
      .filter((item) => ['string', 'number', 'boolean'].includes(typeof item))
      .join(' | ');
  }
  if (typeof value === 'object' && !(value instanceof Date)) return '';
  return value;
}

export function projectionToExportRows(projection) {
  return (projection.rows || []).map((row) => Object.fromEntries(
    projection.columns.map((column) => [
      column.header,
      normalizeProjectionCell(row[column.key]),
    ]),
  ));
}

export function renderReportProjectionCsv(projection) {
  const rows = projectionToExportRows(projection);
  return rowsToCsvBuffer(rows, projection.columns.map(({ header }) => header));
}

export function renderReportProjectionXlsx(projection, { sheetName = 'Reporte' } = {}) {
  const rows = projectionToExportRows(projection);
  return rowsToXlsxBuffer(rows, sheetName, projection.columns.map(({ header }) => header));
}
