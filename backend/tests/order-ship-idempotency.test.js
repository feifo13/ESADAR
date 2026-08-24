import test from 'node:test';
import assert from 'node:assert/strict';
import {
  batchUpdateOrders,
  shipOrder,
} from '../src/modules/orders/orders.service.js';

const AUDIT_CONTEXT = Object.freeze({
  actorUserId: 7,
  actorLabel: 'ship-idempotency-test',
  source: 'BACKOFFICE',
  ipAddress: null,
  userAgent: 'node-test',
  publicSiteUrl: 'https://example.invalid',
});

function clone(value) {
  return structuredClone(value);
}

function createMutex() {
  let tail = Promise.resolve();

  return async function acquire() {
    let release;
    const current = new Promise((resolve) => {
      release = resolve;
    });
    const previous = tail;
    tail = previous.then(() => current);
    await previous;
    return release;
  };
}

function createShipHarness(initialStatus = 'APPROVED', id = 101) {
  const acquireOrderLock = createMutex();
  const state = {
    order: {
      id,
      orderNumber: `SHIP-${id}`,
      orderStatus: initialStatus,
      shippedAt: null,
    },
    inventory: {
      quantityTotal: 8,
      quantityAvailable: 3,
      quantityReserved: 0,
      quantitySold: 5,
      quantityLost: 0,
    },
    history: [],
    audit: [],
    emails: [],
  };

  const dependencies = {
    async runInTransaction(handler) {
      let releaseOrderLock = null;
      const connection = {
        async execute(sql, params = []) {
          const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();

          if (
            normalizedSql.includes('SELECT id FROM orders')
            && normalizedSql.includes('FOR UPDATE')
          ) {
            releaseOrderLock = await acquireOrderLock();
            return [[{ id: state.order.id }]];
          }

          if (normalizedSql.startsWith('UPDATE orders')) {
            assert.match(normalizedSql, /order_status = 'APPROVED'/);
            if (state.order.orderStatus !== 'APPROVED') {
              return [{ affectedRows: 0 }];
            }
            state.order.orderStatus = 'SHIPPED';
            state.order.shippedAt = new Date().toISOString();
            state.order.updatedBy = params[0];
            return [{ affectedRows: 1 }];
          }

          if (normalizedSql.startsWith('INSERT INTO order_status_history')) {
            state.history.push({
              orderId: params[0],
              fromStatus: params[1],
              toStatus: 'SHIPPED',
            });
            return [{ affectedRows: 1, insertId: state.history.length }];
          }

          throw new Error(`Unexpected SQL in ship harness: ${normalizedSql}`);
        },
      };

      try {
        return await handler(connection);
      } finally {
        releaseOrderLock?.();
      }
    },
    async getOrderById() {
      return clone(state.order);
    },
    async logAudit(input) {
      state.audit.push(clone(input));
    },
    async sendShippedOrderEmail(order) {
      state.emails.push(clone(order));
      return { accepted: true };
    },
  };

  return { state, dependencies };
}

function assertInventoryBalanced(inventory) {
  assert.equal(
    inventory.quantityTotal,
    inventory.quantityAvailable
      + inventory.quantityReserved
      + inventory.quantitySold
      + inventory.quantityLost,
  );
}

function assertExactlyOneShipSideEffect(state) {
  assert.equal(state.order.orderStatus, 'SHIPPED');
  assert.equal(state.history.length, 1);
  assert.deepEqual(state.history[0], {
    orderId: state.order.id,
    fromStatus: 'APPROVED',
    toStatus: 'SHIPPED',
  });
  assert.equal(state.audit.length, 1);
  assert.equal(state.audit[0].actionCode, 'ORDER_SHIPPED');
  assert.equal(state.emails.length, 1);
}

test('SHIP-01: APPROVED transitions once to SHIPPED without stock mutation', async () => {
  const { state, dependencies } = createShipHarness('APPROVED', 201);
  const inventoryBefore = clone(state.inventory);

  const order = await shipOrder(201, AUDIT_CONTEXT, dependencies);

  assert.equal(order.orderStatus, 'SHIPPED');
  assertExactlyOneShipSideEffect(state);
  assert.deepEqual(state.inventory, inventoryBefore);
  assertInventoryBalanced(state.inventory);
});

test('SHIP-02: sequential duplicate ship is an idempotent no-op', async () => {
  const { state, dependencies } = createShipHarness('APPROVED', 202);
  const inventoryBefore = clone(state.inventory);

  const first = await shipOrder(202, AUDIT_CONTEXT, dependencies);
  const second = await shipOrder(202, AUDIT_CONTEXT, dependencies);

  assert.equal(first.orderStatus, 'SHIPPED');
  assert.equal(second.orderStatus, 'SHIPPED');
  assertExactlyOneShipSideEffect(state);
  assert.deepEqual(state.inventory, inventoryBefore);
});

test('SHIP-03: concurrent duplicate ship serializes and performs one transition', async () => {
  const { state, dependencies } = createShipHarness('APPROVED', 203);
  const inventoryBefore = clone(state.inventory);

  const results = await Promise.allSettled([
    shipOrder(203, AUDIT_CONTEXT, dependencies),
    shipOrder(203, AUDIT_CONTEXT, dependencies),
  ]);

  assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 2);
  assertExactlyOneShipSideEffect(state);
  assert.deepEqual(state.inventory, inventoryBefore);
});

test('SHIP-04: 16 concurrent duplicate iterations never duplicate side effects', async () => {
  const iterations = Array.from({ length: 16 }, (_, index) =>
    createShipHarness('APPROVED', 300 + index));

  const results = await Promise.all(
    iterations.map(async ({ state, dependencies }) => {
      const inventoryBefore = clone(state.inventory);
      const settled = await Promise.allSettled([
        shipOrder(state.order.id, AUDIT_CONTEXT, dependencies),
        shipOrder(state.order.id, AUDIT_CONTEXT, dependencies),
      ]);
      return { state, inventoryBefore, settled };
    }),
  );

  assert.equal(
    results.filter(({ settled }) =>
      settled.every(({ status }) => status === 'fulfilled')).length,
    16,
  );
  assert.equal(
    results.filter(({ state }) => state.history.length > 1).length,
    0,
  );
  assert.equal(
    results.filter(({ state }) => state.audit.length > 1).length,
    0,
  );
  assert.equal(
    results.filter(({ state }) => state.emails.length > 1).length,
    0,
  );

  for (const { state, inventoryBefore } of results) {
    assertExactlyOneShipSideEffect(state);
    assert.deepEqual(state.inventory, inventoryBefore);
    assertInventoryBalanced(state.inventory);
  }
});

for (const [caseId, orderStatus] of [
  ['SHIP-05', 'RESERVED'],
  ['SHIP-06', 'CANCELLED'],
  ['SHIP-07', 'EXPIRED'],
]) {
  test(`${caseId}: ${orderStatus} is rejected without side effects`, async () => {
    const { state, dependencies } = createShipHarness(orderStatus);
    const inventoryBefore = clone(state.inventory);

    await assert.rejects(
      () => shipOrder(state.order.id, AUDIT_CONTEXT, dependencies),
      /Solo se pueden marcar como enviadas las órdenes aprobadas/,
    );

    assert.equal(state.history.length, 0);
    assert.equal(state.audit.length, 0);
    assert.equal(state.emails.length, 0);
    assert.deepEqual(state.inventory, inventoryBefore);
  });
}

test('SHIP-08: repeated batch SHIP inherits canonical idempotency', async () => {
  const { state, dependencies } = createShipHarness('APPROVED', 208);

  const first = await batchUpdateOrders(
    { action: 'SHIP', ids: [208] },
    AUDIT_CONTEXT,
    dependencies,
  );
  const second = await batchUpdateOrders(
    { action: 'SHIP', ids: [208] },
    AUDIT_CONTEXT,
    dependencies,
  );

  assert.deepEqual(
    [first.succeeded, first.failed, second.succeeded, second.failed],
    [1, 0, 1, 0],
  );
  assert.equal(second.results[0].status, 'SHIPPED');
  assertExactlyOneShipSideEffect(state);
});
