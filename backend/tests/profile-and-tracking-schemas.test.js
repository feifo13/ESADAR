import test from 'node:test';
import assert from 'node:assert/strict';
import { accountProfileUpdateSchema } from '../src/modules/account/account.schemas.js';
import { orderTrackingUpdateSchema } from '../src/modules/orders/orders.schemas.js';

test('account profile schema strips email changes from user profile updates', () => {
  const parsed = accountProfileUpdateSchema.parse({
    firstName: 'Lucia',
    lastName: 'Cliente',
    email: 'nuevo@example.test',
    phone: '099123456',
  });

  assert.equal(parsed.email, undefined);
  assert.equal(parsed.firstName, 'Lucia');
});

test('order tracking schema trims and bounds tracking codes', () => {
  assert.deepEqual(
    orderTrackingUpdateSchema.parse({ trackingCode: '  UY123456  ' }),
    { trackingCode: 'UY123456' },
  );

  assert.throws(
    () => orderTrackingUpdateSchema.parse({ trackingCode: 'x'.repeat(121) }),
    /Too big|String must contain at most/,
  );
});
