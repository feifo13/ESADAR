import test from 'node:test';
import assert from 'node:assert/strict';
import { batchOrderActionSchema } from '../src/modules/orders/orders.schemas.js';
import { batchOfferActionSchema } from '../src/modules/offers/offers.schemas.js';
import { adminArticleBatchActionSchema } from '../src/modules/articles/articles.schemas.js';

test('batch order action schema accepts only supported actions and unique positive ids', () => {
  const parsed = batchOrderActionSchema.parse({
    action: 'APPROVE',
    ids: ['1', 2, 2, '3'],
  });

  assert.deepEqual(parsed, { action: 'APPROVE', ids: [1, 2, 3] });
  assert.throws(
    () => batchOrderActionSchema.parse({ action: 'DELETE', ids: [1] }),
    /Invalid option/,
  );
  assert.throws(
    () => batchOrderActionSchema.parse({ action: 'SHIP', ids: [] }),
    /Too small/,
  );
});

test('batch offer action schema accepts only accept or cancel actions', () => {
  const parsed = batchOfferActionSchema.parse({
    action: 'CANCEL',
    ids: ['8', 9, 9],
    reason: 'Cancelada desde lote',
  });

  assert.deepEqual(parsed, {
    action: 'CANCEL',
    ids: [8, 9],
    reason: 'Cancelada desde lote',
  });
  assert.throws(
    () => batchOfferActionSchema.parse({ action: 'REJECT', ids: [1] }),
    /Invalid option/,
  );
});


test('batch article action schema accepts supported article actions and unique ids', () => {
  const parsed = adminArticleBatchActionSchema.parse({
    action: 'ALLOW_OFFERS',
    ids: ['3', 4, 4],
  });

  assert.deepEqual(parsed, { action: 'ALLOW_OFFERS', ids: [3, 4] });
  assert.throws(
    () => adminArticleBatchActionSchema.parse({ action: 'DELETE', ids: [1] }),
    /Invalid option/,
  );
  assert.throws(
    () => adminArticleBatchActionSchema.parse({ action: 'ACTIVATE', ids: [] }),
    /Too small/,
  );
});
