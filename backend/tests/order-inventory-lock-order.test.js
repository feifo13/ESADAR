import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  aggregateInventoryOperationsCanonical,
  lockInventoryOperationsCanonical,
  sortInventoryOperationsCanonical,
} from '../src/modules/inventory/inventory-lock-order.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const ordersSource = readFileSync(
  resolve(currentDir, '../src/modules/orders/orders.service.js'),
  'utf8',
);
const expirationSource = readFileSync(
  resolve(currentDir, '../src/modules/orders/orders.expiration.service.js'),
  'utf8',
);

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

function assertCanonicalLockBeforeTransition(section, transitionName) {
  const lockIndex = section.indexOf('lockInventoryOperationsCanonical(');
  const transitionIndex = section.indexOf(`${transitionName}(`);
  assert.notEqual(lockIndex, -1);
  assert.notEqual(transitionIndex, -1);
  assert.ok(lockIndex < transitionIndex);
}

test('LOCK-01: AB and BA acquire inventory locks in the same article-id order', async () => {
  async function observedLocks(operations) {
    const articleIds = [];
    const connection = {
      async execute(sql, params) {
        assert.match(sql, /FOR UPDATE/);
        articleIds.push(Number(params[0]));
        return [[{
          articleId: Number(params[0]),
          quantityTotal: 10,
          quantityAvailable: 10,
          quantityReserved: 0,
          quantitySold: 0,
          quantityLost: 0,
        }]];
      },
    };

    await lockInventoryOperationsCanonical(connection, operations);
    return articleIds;
  }

  assert.deepEqual(
    await observedLocks([{ articleId: 20 }, { articleId: 10 }]),
    [10, 20],
  );
  assert.deepEqual(
    await observedLocks([{ articleId: 10 }, { articleId: 20 }]),
    [10, 20],
  );
});

test('LOCK-02: canonical sorting does not mutate domain item order or lose duplicate quantities', () => {
  const domainItems = [
    { articleId: 20, quantity: 1, label: 'B-first' },
    { articleId: 10, quantity: 2, label: 'A-second' },
    { articleId: 20, quantity: 3, label: 'B-duplicate' },
  ];
  const originalSnapshot = structuredClone(domainItems);

  const sorted = sortInventoryOperationsCanonical(domainItems);
  const aggregated = aggregateInventoryOperationsCanonical(domainItems);

  assert.deepEqual(domainItems, originalSnapshot);
  assert.notStrictEqual(sorted, domainItems);
  assert.deepEqual(sorted.map(({ articleId }) => articleId), [10, 20, 20]);
  assert.deepEqual(aggregated, [
    { articleId: 10, quantity: 2 },
    { articleId: 20, quantity: 4 },
  ]);
});

test('LOCK-03: approve prelocks aggregated inventory before SALE transitions', () => {
  const section = sourceSection(
    ordersSource,
    'export async function approveOrder',
    'export async function cancelOrder',
  );

  assert.match(section, /aggregateOrderItemQuantities\(items\)/);
  assertCanonicalLockBeforeTransition(section, 'confirmSale');
});

test('LOCK-04: cancel prelocks aggregated inventory before RELEASE_RESERVATION', () => {
  const section = sourceSection(
    ordersSource,
    'export async function cancelOrder',
    'export async function shipOrder',
  );

  assert.match(section, /aggregateOrderItemQuantities\(items\)/);
  assertCanonicalLockBeforeTransition(section, 'releaseReservation');
});

test('LOCK-05: expiration prelocks per-order canonical inventory before release', () => {
  const lockIndex = expirationSource.indexOf(
    'lockInventoryOperationsCanonical(',
  );
  const releaseIndex = expirationSource.indexOf('releaseReservation(');

  assert.doesNotMatch(expirationSource, /allInventoryOperations/);
  assert.notEqual(lockIndex, -1);
  assert.notEqual(releaseIndex, -1);
  assert.ok(lockIndex < releaseIndex);
});

test('LOCK-06: create prelocks canonical inventory while persisting input item order', () => {
  const section = sourceSection(
    ordersSource,
    'export async function createOrder',
    'export async function listOrders',
  );

  assertCanonicalLockBeforeTransition(section, 'reserveForOrder');
  assert.match(section, /for \(const item of input\.items\)/);
});

test('LOCK-07: Mercado Pago approval uses the shared canonical lock before SALE', () => {
  const section = sourceSection(
    ordersSource,
    'export async function applyMercadoPagoPaymentToOrder',
    'async function getShippingMethod',
  );

  assert.match(section, /aggregateOrderItemQuantities\(items\)/);
  assertCanonicalLockBeforeTransition(section, 'confirmSale');
});
