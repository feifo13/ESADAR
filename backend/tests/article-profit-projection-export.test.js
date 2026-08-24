import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('article profitability moves to canonical Reports while operational article exports remain', () => {
  const routesSource = readFileSync(
    resolve(__dirname, '../src/modules/articles/articles.routes.js'),
    'utf8',
  );
  const reportRoutesSource = readFileSync(
    resolve(__dirname, '../src/modules/reports/reports.routes.js'),
    'utf8',
  );
  const reportProjectionSource = readFileSync(
    resolve(__dirname, '../src/modules/reports/profit-projection.report.js'),
    'utf8',
  );
  const projectionSource = readFileSync(
    resolve(__dirname, '../src/modules/articles/article-financial-projection.js'),
    'utf8',
  );

  assert.doesNotMatch(routesSource, /\/profit-projection\/export/);
  assert.match(reportRoutesSource, /\/profit-projection/);
  assert.match(routesSource, /adminRouter\.get\('\/export'/);
  assert.match(routesSource, /adminRouter\.get\('\/import\/template'/);
  assert.match(routesSource, /adminRouter\.post\(\s*'\/import\/preview'/);
  assert.match(routesSource, /adminRouter\.post\(\s*'\/import'/);
  assert.match(reportProjectionSource, /Código/);
  assert.match(reportProjectionSource, /Base impuesto bancario/);
  assert.match(reportProjectionSource, /Tasa bancaria %/);
  assert.match(reportProjectionSource, /Ganancia proyectada/);
  assert.match(reportProjectionSource, /buildArticleFinancialProjectionRows/);
  assert.match(reportProjectionSource, /buildArticleProfitProjectionSummary/);
  assert.match(projectionSource, /totalBankTax \+= asNumber\(row\.bankTax\)/);
  assert.match(projectionSource, /weightedMargin/);
});
