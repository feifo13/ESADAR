import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { accountProfileUpdateSchema } from '../src/modules/account/account.schemas.js';
import { orderTrackingUpdateSchema } from '../src/modules/orders/orders.schemas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('account profile schema validates the immutable credential email and complete profile', () => {
  const parsed = accountProfileUpdateSchema.parse({
    firstName: 'Lucia',
    lastName: 'Cliente',
    email: 'nuevo@example.test',
    phone: '099123456',
    defaultAddress: {
      addressLine: 'Calle 1',
      city: 'Montevideo',
      state: 'Montevideo',
      country: 'Uruguay',
      postalCode: '11600',
      dwellingType: 'HOUSE',
    },
  });

  assert.equal(parsed.email, 'nuevo@example.test');
  assert.equal(parsed.phone, '99123456');
  assert.equal(parsed.firstName, 'Lucia');
});

test('order tracking schema trims and bounds tracking codes', () => {
  assert.deepEqual(
    orderTrackingUpdateSchema.parse({ trackingCode: '  UY   123456  ' }),
    { trackingCode: 'UY 123456' },
  );

  assert.deepEqual(
    orderTrackingUpdateSchema.parse({ trackingCode: null }),
    { trackingCode: '' },
  );

  assert.throws(
    () => orderTrackingUpdateSchema.parse({ trackingCode: 'x'.repeat(121) }),
    /Too big|String must contain at most/,
  );
});

test('account profile service resolves preferred shipping from existing shipping method fields', () => {
  const source = readFileSync(
    resolve(__dirname, '../src/modules/account/account.service.js'),
    'utf8',
  );

  assert.match(source, /description AS name/);
  assert.doesNotMatch(source, /SELECT[\s\S]*\n\s+name,[\s\S]*FROM shipping_methods/);
});
