import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('orders service delegates stock transitions to inventory service', () => {
  const source = readFileSync(
    resolve(__dirname, '../src/modules/orders/orders.service.js'),
    'utf8',
  );

  assert.match(source, /reserveForOrder/);
  assert.match(source, /releaseReservation/);
  assert.match(source, /confirmSale/);
  assert.doesNotMatch(source, /article-stock\.service/);
  assert.doesNotMatch(source, /UPDATE\s+articles[\s\S]*quantity_available/i);
});

test('orders service records tracking updates as history events only when changed', () => {
  const source = readFileSync(
    resolve(__dirname, '../src/modules/orders/orders.service.js'),
    'utf8',
  );

  assert.match(source, /previousTrackingCode === trackingCode/);
  assert.match(source, /UPDATE orders[\s\S]*tracking_code = \?/);
  assert.doesNotMatch(source, /INSERT INTO order_tracking/i);
  assert.match(source, /TRACKING_UPDATED/);
  assert.match(source, /metadata_json/);
  assert.match(source, /Seguimiento actualizado/);
  assert.match(source, /Seguimiento limpiado/);
});
