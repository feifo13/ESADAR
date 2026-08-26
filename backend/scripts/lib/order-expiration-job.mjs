import { createHash } from 'node:crypto';

export const LOCK_WAIT_SECONDS = 0;
export const JOB_EXIT_CODES = Object.freeze({
  SUCCESS: 0,
  FATAL_FAILURE: 1,
  PARTIAL_FAILURE: 2,
});

const LOCK_NAME_PREFIX = 'esadar:reservation-expiration:';

export function markOutcomeFatal(outcome, nextErrorClass) {
  const currentErrorClass = outcome.observation.error_class;

  return {
    exitCode: JOB_EXIT_CODES.FATAL_FAILURE,
    observation: {
      ...outcome.observation,
      result: 'FATAL_FAILURE',
      error_class: currentErrorClass
        ? `${currentErrorClass}+${nextErrorClass}`
        : nextErrorClass,
    },
  };
}

export function buildOrderExpirationLockName(databaseName) {
  const normalizedDatabaseName = String(databaseName || '').trim();
  if (!normalizedDatabaseName) {
    throw new TypeError('Database name is required for the expiration lock.');
  }

  const databaseToken = createHash('sha256')
    .update(normalizedDatabaseName)
    .digest('hex')
    .slice(0, 24);

  return `${LOCK_NAME_PREFIX}${databaseToken}`;
}

function normalizeCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0
    ? Math.trunc(numeric)
    : 0;
}

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('Job clock returned an invalid date.');
  }
  return date;
}

function readScalarResult(queryResult, field) {
  const rows = queryResult?.[0];
  return Array.isArray(rows) ? rows[0]?.[field] : undefined;
}

export async function runOrderExpirationJob({
  connectionPool,
  expireReservedOrders,
  databaseName,
  clock = () => new Date(),
} = {}) {
  const startedAt = asDate(clock());
  const metrics = {
    scannedCount: 0,
    expiredCount: 0,
    skippedCount: 0,
    failedCount: 0,
  };
  let dedicatedConnection = null;
  let lockName = null;
  let lockAcquired = false;
  let result = 'FATAL_FAILURE';
  let exitCode = JOB_EXIT_CODES.FATAL_FAILURE;
  let errorClass = null;

  function markFatal(nextErrorClass) {
    errorClass = errorClass
      ? `${errorClass}+${nextErrorClass}`
      : nextErrorClass;
    result = 'FATAL_FAILURE';
    exitCode = JOB_EXIT_CODES.FATAL_FAILURE;
  }

  try {
    if (
      !connectionPool
      || typeof connectionPool.getConnection !== 'function'
      || typeof expireReservedOrders !== 'function'
    ) {
      throw new TypeError('Invalid order expiration job dependencies.');
    }

    lockName = buildOrderExpirationLockName(databaseName);

    try {
      dedicatedConnection = await connectionPool.getConnection();
    } catch {
      markFatal('DEDICATED_CONNECTION_ERROR');
    }

    if (dedicatedConnection) {
      let acquiredValue;

      try {
        acquiredValue = readScalarResult(
          await dedicatedConnection.execute(
            `SELECT GET_LOCK(?, ${LOCK_WAIT_SECONDS}) AS acquired`,
            [lockName],
          ),
          'acquired',
        );
      } catch {
        markFatal('ADVISORY_LOCK_ACQUIRE_ERROR');
      }

      if (!errorClass) {
        if (acquiredValue == null) {
          markFatal('ADVISORY_LOCK_RESULT_ERROR');
        } else if (Number(acquiredValue) === 0) {
          result = 'LOCK_BUSY';
          exitCode = JOB_EXIT_CODES.SUCCESS;
        } else if (Number(acquiredValue) === 1) {
          lockAcquired = true;

          try {
            const expirationResult = await expireReservedOrders({
              auditContext: {
                actorUserId: null,
                actorLabel: null,
                source: 'SYSTEM',
              },
            });

            metrics.scannedCount = normalizeCount(
              expirationResult?.scannedCount,
            );
            metrics.expiredCount = normalizeCount(
              expirationResult?.expiredCount,
            );
            metrics.skippedCount = normalizeCount(
              expirationResult?.skippedCount,
            );
            metrics.failedCount = normalizeCount(
              expirationResult?.failedCount,
            );

            if (metrics.failedCount > 0) {
              result = 'PARTIAL_FAILURE';
              exitCode = JOB_EXIT_CODES.PARTIAL_FAILURE;
            } else {
              result = 'SUCCESS';
              exitCode = JOB_EXIT_CODES.SUCCESS;
            }
          } catch {
            markFatal('EXPIRATION_EXECUTION_ERROR');
          }
        } else {
          markFatal('ADVISORY_LOCK_RESULT_ERROR');
        }
      }
    }
  } catch {
    markFatal('JOB_CONFIGURATION_ERROR');
  } finally {
    if (dedicatedConnection) {
      if (lockAcquired) {
        try {
          const releasedValue = readScalarResult(
            await dedicatedConnection.execute(
              'SELECT RELEASE_LOCK(?) AS released',
              [lockName],
            ),
            'released',
          );

          if (Number(releasedValue) !== 1) {
            markFatal('ADVISORY_LOCK_RELEASE_ERROR');
          }
        } catch {
          markFatal('ADVISORY_LOCK_RELEASE_ERROR');
        }
      }

      try {
        await dedicatedConnection.release();
      } catch {
        markFatal('DEDICATED_CONNECTION_RELEASE_ERROR');
      }
    }

  }

  const completedAt = asDate(clock());
  const observation = {
    started_at: startedAt.toISOString(),
    completed_at: completedAt.toISOString(),
    duration_ms: Math.max(0, completedAt.getTime() - startedAt.getTime()),
    lock_acquired: lockAcquired,
    scanned_count: metrics.scannedCount,
    expired_count: metrics.expiredCount,
    skipped_count: metrics.skippedCount,
    failed_count: metrics.failedCount,
    result,
    error_class: errorClass,
  };

  return { exitCode, observation };
}
