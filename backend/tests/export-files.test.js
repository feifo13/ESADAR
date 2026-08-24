import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {
  neutralizeCsvFormulaText,
  rowsToCsvBuffer,
  rowsToXlsxBuffer,
} from '../src/utils/export-files.js';

test('CSV neutralizes effectively leading spreadsheet formula prefixes', () => {
  const values = [
    '=1+1',
    '+SUM(1,2)',
    '-1+1',
    '@cmd',
    '  =1+1',
    '\t+SUM(1,2)',
    '\u0001-1+1',
  ];

  for (const value of values) {
    assert.equal(neutralizeCsvFormulaText(value), `'${value}`);
  }
  assert.equal(neutralizeCsvFormulaText('texto normal'), 'texto normal');
  assert.equal(neutralizeCsvFormulaText(-12), -12);
});

test('CSV formula protection preserves BOM, quoting, numeric values, and line ending', () => {
  const payload = rowsToCsvBuffer([
    { text: '=1+1', amount: -12, quoted: 'texto, "visible"' },
    { text: '  @cmd', amount: 3.5, quoted: 'línea\nnueva' },
  ], ['text', 'amount', 'quoted']);
  const csv = payload.toString('utf8');

  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /'=1\+1,-12,"texto, ""visible"""/);
  assert.match(csv, /'  @cmd,3\.5,"línea\nnueva"/);
  assert.ok(csv.endsWith('\n'));
});

test('XLSX user strings remain explicit text while numerics remain typed', async () => {
  const payload = await rowsToXlsxBuffer(
    [{ text: '=1+1', amount: -12.5 }],
    'Seguridad',
    ['text', 'amount'],
  );
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(payload);
  const worksheet = workbook.getWorksheet('Seguridad');
  const textCell = worksheet.getCell('A2');
  const numericCell = worksheet.getCell('B2');

  assert.equal(textCell.value, '=1+1');
  assert.equal(textCell.type, ExcelJS.ValueType.String);
  assert.equal(textCell.formula, undefined);
  assert.equal(numericCell.value, -12.5);
  assert.equal(numericCell.type, ExcelJS.ValueType.Number);
});
