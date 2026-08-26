import assert from 'node:assert/strict';
import test from 'node:test';

import {
  JOB_EXIT_CODES,
  LOCK_WAIT_SECONDS,
  buildOrderExpirationLockName,
  markOutcomeFatal,
  runOrderExpirationJob,
} from '../scripts/lib/order-expiration-job.mjs';

const DEFAULT_EXPIRATION_RESULT = Object.freeze({
  scannedCount: 4,
  expiredCount: 2,
  skippedCount: 2,
  failedCount: 0,
});

function createHarness({
  databaseName = 'esadar_test',
  lockResult = 1,
  lockError = null,
  releaseLockResult = 1,
  releaseLockError = null,
  expirationResult = DEFAULT_EXPIRATION_RESULT,
  expirationError = null,
  connectionReleaseError = null,
  includePoolEndSpy = false,
} = {}) {
  const state = {
    getConnectionCount: 0,
    queries: [],
    expirationCalls: [],
    connectionReleaseCount: 0,
    poolEndCount: 0,
  };

  const dedicatedConnection = {
    async execute(sql, params) {
      state.queries.push({ connection: dedicatedConnection, sql, params });

      if (sql.includes('GET_LOCK')) {
        if (lockError) throw lockError;
        return [[{ acquired: lockResult }]];
      }

      if (sql.includes('RELEASE_LOCK')) {
        if (releaseLockError) throw releaseLockError;
        return [[{ released: releaseLockResult }]];
      }

      throw new Error('Unexpected SQL in test harness.');
    },
    async release() {
      state.connectionReleaseCount += 1;
      if (connectionReleaseError) throw connectionReleaseError;
    },
  };

  const connectionPool = {
    async getConnection() {
      state.getConnectionCount += 1;
      return dedicatedConnection;
    },
  };

  if (includePoolEndSpy) {
    connectionPool.end = async () => {
      state.poolEndCount += 1;
    };
  }

  async function expireReservedOrders(options) {
    state.expirationCalls.push(options);
    if (expirationError) throw expirationError;
    return expirationResult;
  }

  const clockValues = [
    new Date('2026-08-26T12:00:00.000Z'),
    new Date('2026-08-26T12:00:00.250Z'),
  ];

  return {
    state,
    dedicatedConnection,
    connectionPool,
    async run() {
      return runOrderExpirationJob({
        connectionPool,
        expireReservedOrders,
        databaseName,
        clock: () => clockValues.shift(),
      });
    },
  };
}

function findQuery(state, operation) {
  return state.queries.find(({ sql }) => sql.includes(operation));
}

test('JOB-01 GET_LOCK uses timeout zero and a safe deterministic name', async () => {
  const harness = createHarness();
  await harness.run();

  const lockQuery = findQuery(harness.state, 'GET_LOCK');
  assert.equal(LOCK_WAIT_SECONDS, 0);
  assert.match(lockQuery.sql, /GET_LOCK\(\?, 0\)/);
  assert.deepEqual(lockQuery.params, [buildOrderExpirationLockName('esadar_test')]);
  assert.ok(lockQuery.params[0].length <= 64);
  assert.equal(
    buildOrderExpirationLockName('esadar_test'),
    buildOrderExpirationLockName('esadar_test'),
  );
});

test('JOB-02 advisory lock uses a dedicated pool connection', async () => {
  const harness = createHarness();
  await harness.run();

  assert.equal(harness.state.getConnectionCount, 1);
  assert.equal(
    findQuery(harness.state, 'GET_LOCK').connection,
    harness.dedicatedConnection,
  );
});

test('JOB-03 LOCK_BUSY does not invoke expiration', async () => {
  const harness = createHarness({ lockResult: 0 });
  await harness.run();

  assert.equal(harness.state.expirationCalls.length, 0);
});

test('JOB-04 LOCK_BUSY is an operational success', async () => {
  const harness = createHarness({ lockResult: 0 });
  const outcome = await harness.run();

  assert.equal(outcome.exitCode, JOB_EXIT_CODES.SUCCESS);
  assert.equal(outcome.observation.result, 'LOCK_BUSY');
  assert.equal(outcome.observation.lock_acquired, false);
});

test('JOB-05 LOCK_ACQUIRED invokes expiration exactly once', async () => {
  const harness = createHarness();
  await harness.run();

  assert.equal(harness.state.expirationCalls.length, 1);
});

test('JOB-06 expiration receives only the canonical SYSTEM audit context', async () => {
  const harness = createHarness();
  await harness.run();

  assert.deepEqual(harness.state.expirationCalls, [{
    auditContext: {
      actorUserId: null,
      actorLabel: null,
      source: 'SYSTEM',
    },
  }]);
});

test('JOB-07 failedCount zero is success', async () => {
  const harness = createHarness({
    expirationResult: { ...DEFAULT_EXPIRATION_RESULT, failedCount: 0 },
  });
  const outcome = await harness.run();

  assert.equal(outcome.exitCode, JOB_EXIT_CODES.SUCCESS);
  assert.equal(outcome.observation.result, 'SUCCESS');
  assert.equal(outcome.observation.error_class, null);
});

test('JOB-08 failedCount above zero is partial failure with nonzero exit', async () => {
  const harness = createHarness({
    expirationResult: { ...DEFAULT_EXPIRATION_RESULT, failedCount: 3 },
  });
  const outcome = await harness.run();

  assert.equal(outcome.exitCode, JOB_EXIT_CODES.PARTIAL_FAILURE);
  assert.notEqual(outcome.exitCode, 0);
  assert.equal(outcome.observation.result, 'PARTIAL_FAILURE');
  assert.equal(outcome.observation.failed_count, 3);
});

test('JOB-09 expiration exception is a sanitized fatal failure', async () => {
  const harness = createHarness({
    expirationError: new Error('sensitive SQL details'),
  });
  const outcome = await harness.run();

  assert.equal(outcome.exitCode, JOB_EXIT_CODES.FATAL_FAILURE);
  assert.equal(outcome.observation.result, 'FATAL_FAILURE');
  assert.equal(outcome.observation.error_class, 'EXPIRATION_EXECUTION_ERROR');
});

test('JOB-10 RELEASE_LOCK uses the same dedicated connection and lock name', async () => {
  const harness = createHarness();
  await harness.run();

  const getQuery = findQuery(harness.state, 'GET_LOCK');
  const releaseQuery = findQuery(harness.state, 'RELEASE_LOCK');
  assert.equal(getQuery.connection, harness.dedicatedConnection);
  assert.equal(releaseQuery.connection, harness.dedicatedConnection);
  assert.deepEqual(releaseQuery.params, getQuery.params);
});

test('JOB-11 RELEASE_LOCK is attempted after expiration failure', async () => {
  const harness = createHarness({
    expirationError: new Error('expiration failure'),
  });
  await harness.run();

  assert.ok(findQuery(harness.state, 'RELEASE_LOCK'));
});

test('JOB-12 dedicated connection is always released', async () => {
  for (const options of [
    {},
    { lockResult: 0 },
    { lockError: new Error('lock failure') },
    { expirationError: new Error('expiration failure') },
  ]) {
    const harness = createHarness(options);
    await harness.run();
    assert.equal(harness.state.connectionReleaseCount, 1);
  }

  const releaseFailureHarness = createHarness({
    connectionReleaseError: new Error('connection release details'),
  });
  const outcome = await releaseFailureHarness.run();
  assert.equal(releaseFailureHarness.state.connectionReleaseCount, 1);
  assert.equal(outcome.exitCode, JOB_EXIT_CODES.FATAL_FAILURE);
  assert.match(
    outcome.observation.error_class,
    /DEDICATED_CONNECTION_RELEASE_ERROR/,
  );
});

test('JOB-POOL-01 library never owns or requires pool.end', async () => {
  const poolWithoutEndHarness = createHarness();
  const outcomeWithoutEnd = await poolWithoutEndHarness.run();
  assert.equal(outcomeWithoutEnd.exitCode, JOB_EXIT_CODES.SUCCESS);
  assert.equal('end' in poolWithoutEndHarness.connectionPool, false);

  for (const options of [
    {},
    { lockResult: 0 },
    { expirationError: new Error('expiration failure') },
  ]) {
    const harness = createHarness({ ...options, includePoolEndSpy: true });
    await harness.run();
    assert.equal(harness.state.poolEndCount, 0);
  }
});

test('JOB-POOL-02 pool failure fatalizes every outcome and preserves metrics', async () => {
  for (const options of [
    {},
    { lockResult: 0 },
    {
      expirationResult: { ...DEFAULT_EXPIRATION_RESULT, failedCount: 3 },
    },
    { expirationError: new Error('expiration failure') },
  ]) {
    const outcome = await createHarness(options).run();
    const fatalOutcome = markOutcomeFatal(outcome, 'POOL_END_ERROR');

    assert.equal(fatalOutcome.exitCode, JOB_EXIT_CODES.FATAL_FAILURE);
    assert.equal(fatalOutcome.observation.result, 'FATAL_FAILURE');
    assert.match(fatalOutcome.observation.error_class, /POOL_END_ERROR/);
    assert.deepEqual(
      {
        scanned_count: fatalOutcome.observation.scanned_count,
        expired_count: fatalOutcome.observation.expired_count,
        skipped_count: fatalOutcome.observation.skipped_count,
        failed_count: fatalOutcome.observation.failed_count,
      },
      {
        scanned_count: outcome.observation.scanned_count,
        expired_count: outcome.observation.expired_count,
        skipped_count: outcome.observation.skipped_count,
        failed_count: outcome.observation.failed_count,
      },
    );
  }
});

test('JOB-15 observability contains the required stable metrics and timing', async () => {
  const harness = createHarness();
  const outcome = await harness.run();

  assert.deepEqual(outcome.observation, {
    started_at: '2026-08-26T12:00:00.000Z',
    completed_at: '2026-08-26T12:00:00.250Z',
    duration_ms: 250,
    lock_acquired: true,
    scanned_count: 4,
    expired_count: 2,
    skipped_count: 2,
    failed_count: 0,
    result: 'SUCCESS',
    error_class: null,
  });
});

test('JOB-16 observability excludes order IDs', async () => {
  const harness = createHarness({
    expirationResult: {
      ...DEFAULT_EXPIRATION_RESULT,
      orderIds: [100001, 100002],
    },
  });
  const outcome = await harness.run();
  const serialized = JSON.stringify(outcome.observation);

  assert.equal(Object.hasOwn(outcome.observation, 'orderIds'), false);
  assert.doesNotMatch(serialized, /100001|100002|orderIds/);
});

test('JOB-17 observability excludes supplied secrets and PII', async () => {
  const sensitiveValues = [
    'tenant-password-secret-db',
    'customer@example.test',
    '+59899999999',
    'jwt-secret-token',
  ];
  const harness = createHarness({
    databaseName: sensitiveValues[0],
    expirationError: new Error(sensitiveValues.slice(1).join(' ')),
  });
  const outcome = await harness.run();
  const serialized = JSON.stringify(outcome.observation);

  for (const sensitiveValue of sensitiveValues) {
    assert.equal(serialized.includes(sensitiveValue), false);
  }
});

test('JOB-18 GET_LOCK null or error is fatal and does not run expiration', async () => {
  for (const options of [
    { lockResult: null },
    { lockError: new Error('database lock details') },
  ]) {
    const harness = createHarness(options);
    const outcome = await harness.run();

    assert.equal(outcome.exitCode, JOB_EXIT_CODES.FATAL_FAILURE);
    assert.equal(outcome.observation.result, 'FATAL_FAILURE');
    assert.equal(harness.state.expirationCalls.length, 0);
    assert.equal(harness.state.connectionReleaseCount, 1);
  }
});

test('JOB-19 RELEASE_LOCK failure is fatal and cleanup still completes', async () => {
  for (const options of [
    { releaseLockResult: 0 },
    { releaseLockError: new Error('release details') },
    {
      expirationError: new Error('expiration details'),
      releaseLockError: new Error('release details'),
    },
  ]) {
    const harness = createHarness(options);
    const outcome = await harness.run();

    assert.equal(outcome.exitCode, JOB_EXIT_CODES.FATAL_FAILURE);
    assert.equal(outcome.observation.result, 'FATAL_FAILURE');
    assert.match(
      outcome.observation.error_class,
      /ADVISORY_LOCK_RELEASE_ERROR/,
    );
    assert.equal(harness.state.connectionReleaseCount, 1);
  }
});
