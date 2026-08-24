import ExcelJS from 'exceljs';

function normalizeCellValue(value) {
  if (value == null) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return value;
}

const CSV_FORMULA_PREFIX = /^[\u0000-\u0020\u007f\u00a0]*[=+\-@]/;

export function neutralizeCsvFormulaText(value) {
  if (typeof value !== 'string' || !CSV_FORMULA_PREFIX.test(value)) return value;
  return `'${value}`;
}

function collectColumns(rows, preferredColumns = null) {
  if (Array.isArray(preferredColumns) && preferredColumns.length) return preferredColumns;

  const columns = [];
  const seen = new Set();

  for (const row of rows || []) {
    for (const key of Object.keys(row || {})) {
      if (seen.has(key)) continue;
      seen.add(key);
      columns.push(key);
    }
  }

  return columns.length ? columns : ['estado'];
}

function escapeCsvCell(value) {
  const normalized = normalizeCellValue(value);
  const text = String(neutralizeCsvFormulaText(normalized));
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function rowsToCsvBuffer(rows, preferredColumns = null) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const columns = collectColumns(safeRows, preferredColumns);
  const lines = [
    columns.map(escapeCsvCell).join(','),
    ...safeRows.map((row) => columns.map((column) => escapeCsvCell(row?.[column])).join(',')),
  ];

  return Buffer.from(`\uFEFF${lines.join('\n')}\n`, 'utf8');
}

export function appendRowsSheet(workbook, name, rows, preferredColumns = null) {
  const safeRows = Array.isArray(rows) && rows.length ? rows : [{ estado: 'Sin datos' }];
  const columns = collectColumns(safeRows, preferredColumns);
  const worksheet = workbook.addWorksheet(String(name || 'Hoja').slice(0, 31));

  worksheet.addRow(columns.map((column) => String(column)));
  for (const row of safeRows) {
    const excelRow = worksheet.addRow([]);
    columns.forEach((column, index) => {
      const value = normalizeCellValue(row?.[column]);
      excelRow.getCell(index + 1).value = typeof value === 'string' ? String(value) : value;
    });
  }

  worksheet.getRow(1).font = { bold: true };
  worksheet.columns = columns.map((column) => ({
    key: column,
    width: Math.max(12, Math.min(36, String(column).length + 4)),
  }));

  return worksheet;
}

export function createWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ESADAR';
  workbook.created = new Date();
  return workbook;
}

export async function workbookToXlsxBuffer(workbook) {
  const payload = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
}

export async function rowsToXlsxBuffer(rows, sheetName, preferredColumns = null) {
  const workbook = createWorkbook();
  appendRowsSheet(workbook, sheetName, rows, preferredColumns);
  return workbookToXlsxBuffer(workbook);
}
