#!/usr/bin/env node
import { env } from '../src/config/env.js';
import { pool } from '../src/db/pool.js';
import { expireReservedOrders } from '../src/modules/orders/orders.expiration.service.js';
import {
  markOutcomeFatal,
  runOrderExpirationJob,
} from './lib/order-expiration-job.mjs';

let outcome;

try {
  outcome = await runOrderExpirationJob({
    connectionPool: pool,
    expireReservedOrders,
    databaseName: env.db.database,
  });
} finally {
  try {
    await pool.end();
  } catch {
    outcome = markOutcomeFatal(outcome, 'POOL_END_ERROR');
  }
}

process.stdout.write(`${JSON.stringify(outcome.observation)}\n`);
process.exitCode = outcome.exitCode;
