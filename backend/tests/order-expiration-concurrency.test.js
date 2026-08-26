import test from 'node:test';
import assert from 'node:assert/strict';
import { expirationTestInternals } from '../src/modules/orders/orders.expiration.service.js';

const NOW = new Date('2026-08-26T12:00:00.000Z');

function eligibleOrder(id, overrides = {}) {
  return {
    id,
    orderStatus: 'RESERVED',
    paymentStatus: 'PENDING',
    reservedUntil: 'not-interpreted-by-javascript',
    reservationExpired: 1,
    ...overrides,
  };
}

function buildHarness({ candidates = [], scenarios = {} } = {}) {
  const candidateRows = candidates.map((candidate) => (
    typeof candidate === 'object' ? candidate : { id: candidate }
  ));
  const state = {
    events: [],
    scanQueries: [],
    transactions: [],
    releases: [],
    restores: [],
    history: [],
    audits: [],
    failures: [],
  };
  let transactionIndex = 0;

  const candidateConnection = {
    async execute(sql, params) {
      state.events.push('candidate-scan');
      state.scanQueries.push({ sql, params });
      return [candidateRows];
    },
  };

  const transactionPool = {
    async getConnection() {
      const candidate = candidateRows[transactionIndex];
      transactionIndex += 1;
      const orderId = Number(candidate.id);
      const scenario = scenarios[orderId] || {};
      const transaction = {
        orderId,
        begun: 0,
        committed: 0,
        rolledBack: 0,
        released: 0,
        queries: [],
        inventoryLocks: [],
      };
      state.transactions.push(transaction);

      return {
        orderId,
        async beginTransaction() {
          transaction.begun += 1;
          state.events.push(`begin:${orderId}`);
        },
        async commit() {
          transaction.committed += 1;
          state.events.push(`commit:${orderId}`);
        },
        async rollback() {
          transaction.rolledBack += 1;
          state.events.push(`rollback:${orderId}`);
        },
        release() {
          transaction.released += 1;
          state.events.push(`release:${orderId}`);
        },
        async execute(sql, params) {
          transaction.queries.push({ sql, params });
          const normalizedSql = sql.replace(/\s+/g, ' ').trim();

          if (/FROM orders/i.test(normalizedSql) && /FOR UPDATE/i.test(normalizedSql)) {
            const order = Object.hasOwn(scenario, 'order')
              ? scenario.order
              : eligibleOrder(orderId);
            return [order ? [order] : []];
          }

          if (/FROM order_items/i.test(normalizedSql)) {
            return [scenario.items || []];
          }

          if (/FROM article_inventory/i.test(normalizedSql)) {
            const articleId = Number(params[0]);
            transaction.inventoryLocks.push(articleId);
            return [[{
              articleId,
              quantityTotal: 10,
              quantityAvailable: 8,
              quantityReserved: 2,
              quantitySold: 0,
              quantityLost: 0,
            }]];
          }

          if (/UPDATE orders/i.test(normalizedSql)) {
            return [{
              affectedRows: scenario.updateAffectedRows == null
                ? 1
                : scenario.updateAffectedRows,
            }];
          }

          if (/INSERT INTO order_status_history/i.test(normalizedSql)) {
            state.history.push({ orderId, params });
            return [{ affectedRows: 1 }];
          }

          throw new Error(`Unexpected SQL for order ${orderId}: ${normalizedSql}`);
        },
      };
    },
  };

  const dependencies = {
    candidateConnection,
    transactionPool,
    async releaseReservation(connection, payload) {
      const scenario = scenarios[connection.orderId] || {};
      state.releases.push({ orderId: connection.orderId, ...payload });
      if (scenario.releaseError) throw scenario.releaseError;
    },
    async restoreUsedOffersForOrder(connection, payload) {
      state.restores.push({ orderId: connection.orderId, ...payload });
    },
    async logAudit(payload, connection) {
      state.audits.push({ orderId: connection.orderId, payload });
    },
    async reportOrderFailure(orderId, error) {
      state.failures.push({ orderId: Number(orderId), code: error.code });
    },
  };

  return {
    state,
    async run(options = {}) {
      return expirationTestInternals.expireReservedOrdersWithDependencies(
        {
          now: NOW,
          auditContext: {
            actorUserId: 7,
            source: 'SYSTEM',
          },
          ...options,
        },
        dependencies,
      );
    },
  };
}

test('EXP-UNIT-01: candidate scan does not use FOR UPDATE', async () => {
  const harness = buildHarness();
  await harness.run();

  assert.equal(harness.state.scanQueries.length, 1);
  assert.doesNotMatch(harness.state.scanQueries[0].sql, /FOR UPDATE/i);
  assert.match(harness.state.scanQueries[0].sql, /SELECT id\s+FROM orders/i);
});

test('EXP-UNIT-02: candidate scan is outside any batch-wide transaction', async () => {
  const harness = buildHarness({
    candidates: [1, 2],
    scenarios: {
      1: { order: eligibleOrder(1, { orderStatus: 'APPROVED' }) },
      2: { order: eligibleOrder(2, { orderStatus: 'CANCELLED' }) },
    },
  });
  await harness.run();

  assert.equal(harness.state.events[0], 'candidate-scan');
  assert.equal(harness.state.transactions.length, 2);
  assert.equal(harness.state.scanQueries.length, 1);
});

test('EXP-UNIT-03: every candidate uses an independent transaction', async () => {
  const harness = buildHarness({
    candidates: [1, 2],
    scenarios: {
      1: { order: eligibleOrder(1, { orderStatus: 'APPROVED' }) },
      2: { order: eligibleOrder(2, { orderStatus: 'EXPIRED' }) },
    },
  });
  await harness.run();

  assert.deepEqual(
    harness.state.transactions.map((transaction) => ({
      orderId: transaction.orderId,
      begun: transaction.begun,
      committed: transaction.committed,
      rolledBack: transaction.rolledBack,
      released: transaction.released,
    })),
    [
      { orderId: 1, begun: 1, committed: 1, rolledBack: 0, released: 1 },
      { orderId: 2, begun: 1, committed: 1, rolledBack: 0, released: 1 },
    ],
  );
});

test('EXP-UNIT-04: each order is re-read by primary key with FOR UPDATE', async () => {
  const harness = buildHarness({
    candidates: [41],
    scenarios: {
      41: { order: eligibleOrder(41, { orderStatus: 'APPROVED' }) },
    },
  });
  await harness.run();

  const lockQuery = harness.state.transactions[0].queries[0];
  assert.match(lockQuery.sql, /reserved_until < \?/i);
  assert.match(lockQuery.sql, /AS reservationExpired/i);
  assert.match(lockQuery.sql, /WHERE id = \?/i);
  assert.match(lockQuery.sql, /LIMIT 1\s+FOR UPDATE/i);
  assert.deepEqual(lockQuery.params, ['2026-08-26 12:00:00', 41]);
});

test('EXP-UNIT-05: an already approved order is skipped without stock release', async () => {
  const harness = buildHarness({
    candidates: [5],
    scenarios: {
      5: { order: eligibleOrder(5, { orderStatus: 'APPROVED' }) },
    },
  });
  const result = await harness.run();

  assert.equal(result.skippedCount, 1);
  assert.equal(result.expiredCount, 0);
  assert.equal(harness.state.releases.length, 0);
});

test('EXP-UNIT-06: cancelled and expired orders create no duplicate side effects', async () => {
  const harness = buildHarness({
    candidates: [6, 7],
    scenarios: {
      6: { order: eligibleOrder(6, { orderStatus: 'CANCELLED' }) },
      7: { order: eligibleOrder(7, { orderStatus: 'EXPIRED' }) },
    },
  });
  const result = await harness.run();

  assert.equal(result.skippedCount, 2);
  assert.equal(harness.state.releases.length, 0);
  assert.equal(harness.state.restores.length, 0);
  assert.equal(harness.state.history.length, 0);
  assert.equal(harness.state.audits.length, 0);
});

test('EXP-UNIT-07: SQL expiration false skips without JS Date reinterpretation', async () => {
  const harness = buildHarness({
    candidates: [8],
    scenarios: {
      8: {
        order: eligibleOrder(8, {
          reservedUntil: new Date(NOW.getTime() - 60_000),
          reservationExpired: 0,
        }),
      },
    },
  });
  const result = await harness.run();

  assert.equal(result.skippedCount, 1);
  assert.equal(harness.state.releases.length, 0);
});

test('EXP-UNIT-08: affectedRows zero rolls back that order and counts failure', async () => {
  const harness = buildHarness({
    candidates: [9],
    scenarios: {
      9: {
        items: [{ articleId: 10, quantity: 1 }],
        updateAffectedRows: 0,
      },
    },
  });
  const result = await harness.run();

  assert.equal(result.expiredCount, 0);
  assert.equal(result.failedCount, 1);
  assert.equal(harness.state.releases.length, 1);
  assert.equal(harness.state.transactions[0].committed, 0);
  assert.equal(harness.state.transactions[0].rolledBack, 1);
  assert.equal(harness.state.restores.length, 0);
  assert.equal(harness.state.history.length, 0);
  assert.equal(harness.state.audits.length, 0);
});

test('EXP-UNIT-09: one order failure does not prevent the next candidate', async () => {
  const harness = buildHarness({
    candidates: [10, 11],
    scenarios: {
      10: {
        items: [{ articleId: 10, quantity: 1 }],
        releaseError: Object.assign(new Error('release failed'), {
          code: 'TEST_RELEASE_FAILURE',
        }),
      },
      11: { items: [{ articleId: 10, quantity: 1 }] },
    },
  });
  const result = await harness.run();

  assert.equal(result.failedCount, 1);
  assert.equal(result.expiredCount, 1);
  assert.deepEqual(result.orderIds, [11]);
  assert.equal(harness.state.transactions[0].rolledBack, 1);
  assert.equal(harness.state.transactions[1].committed, 1);
});

test('EXP-UNIT-10: SQL expiration true permits expiration without JS Date parsing', async () => {
  const harness = buildHarness({
    candidates: [12],
    scenarios: {
      12: {
        order: eligibleOrder(12, {
          reservedUntil: 'deliberately-not-a-js-date',
          reservationExpired: 1,
        }),
        items: [{ articleId: 10, quantity: 1 }],
      },
    },
  });
  const result = await harness.run();

  assert.equal(result.expiredCount, 1);
  assert.deepEqual(result.orderIds, [12]);
});

test('EXP-UNIT-11: scanned equals expired plus skipped plus failed', async () => {
  const harness = buildHarness({
    candidates: [13, 14, 15],
    scenarios: {
      13: { items: [{ articleId: 10, quantity: 1 }] },
      14: { order: eligibleOrder(14, { paymentStatus: 'PAID' }) },
      15: {
        items: [{ articleId: 10, quantity: 1 }],
        updateAffectedRows: 0,
      },
    },
  });
  const result = await harness.run();

  assert.equal(result.scannedCount, 3);
  assert.equal(result.expiredCount, 1);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.failedCount, 1);
  assert.equal(
    result.expiredCount + result.skippedCount + result.failedCount,
    result.scannedCount,
  );
});

test('EXP-UNIT-12: inventory locks and releases preserve ARTICLE_ID_ASC', async () => {
  const harness = buildHarness({
    candidates: [16],
    scenarios: {
      16: {
        items: [
          { articleId: 20, quantity: 1 },
          { articleId: 10, quantity: 2 },
        ],
      },
    },
  });
  await harness.run();

  assert.deepEqual(harness.state.transactions[0].inventoryLocks, [10, 20]);
  assert.deepEqual(
    harness.state.releases.map(({ articleId }) => articleId),
    [10, 20],
  );
});
