import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('article profit projection export exposes Spanish headers and explicit route', () => {
  const batchSource = readFileSync(
    resolve(__dirname, '../src/modules/articles/articles.batch.service.js'),
    'utf8',
  );
  const routesSource = readFileSync(
    resolve(__dirname, '../src/modules/articles/articles.routes.js'),
    'utf8',
  );

  assert.match(routesSource, /\/profit-projection\/export/);
  assert.match(batchSource, /ARTICLE_PROFIT_PROJECTION_EXPORT_CREATED/);
  assert.match(batchSource, /Código interno/);
  assert.match(batchSource, /Base impuestos bancarios/);
  assert.match(batchSource, /Tasa impuestos bancarios %/);
  assert.match(batchSource, /Ganancia estimada/);
  assert.match(batchSource, /totalBankTax \+= asNumber\(row\.bankTax\)/);
  assert.match(batchSource, /weightedMargin/);
});
