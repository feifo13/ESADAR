import {
  appendRowsSheet,
  createWorkbook,
  rowsToCsvBuffer,
  workbookToXlsxBuffer,
} from '../../utils/export-files.js';

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
  const projectionRows = [
    ...(projection.rows || []),
    ...(projection.totalRow ? [projection.totalRow] : []),
  ];
  return projectionRows.map((row) => Object.fromEntries(
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

export async function renderReportProjectionXlsx(projection, { sheetName = 'Reporte' } = {}) {
  const rows = projectionToExportRows(projection);
  const workbook = createWorkbook();
  const worksheet = appendRowsSheet(
    workbook,
    sheetName,
    rows,
    projection.columns.map(({ header }) => header),
  );
  if (projection.totalRow) worksheet.getRow(worksheet.rowCount).font = { bold: true };
  return workbookToXlsxBuffer(workbook);
}
