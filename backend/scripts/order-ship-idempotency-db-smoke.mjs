import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import {
  renderBootstrapAdminCredentials,
  runMysqlScript,
} from './lib/mysql-script-runner.mjs';

const currentDir = dirname(fileURLToPath(import.meta.url));
const scratchDatabase = `esadar_codex_ship_idempotency_${process.pid}`;
const dbHost = String(process.env.DB_HOST || '').trim().toLowerCase();

if (!['127.0.0.1', 'localhost', '::1'].includes(dbHost)) {
  throw new Error(
    'Order ship DB smoke refuses to run against a non-local database host.',
  );
}
if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
  throw new Error('Order ship DB smoke refuses to run in production mode.');
}

let pool;
let primaryError = null;

function clone(value) {
  return structuredClone(value);
}

try {
  const fromScratchPath = resolve(
    currentDir,
    '../../db/scripts/01_from_scratch_superadmin_seed.sql',
  );
  const bootstrapPasswordHash = await bcrypt.hash(
    randomBytes(24).toString('hex'),
    10,
  );
  const fromScratchSql = renderBootstrapAdminCredentials(
    (await readFile(fromScratchPath, 'utf8')).replaceAll(
      'esadar_sandbox',
      scratchDatabase,
    ),
    {
      email: `ship-smoke-${process.pid}@example.invalid`,
      passwordHash: bootstrapPasswordHash,
    },
  );

  await runMysqlScript(fromScratchSql, {
    selectDatabase: false,
    stdout: null,
    stderr: null,
  });

  process.env.NODE_ENV = 'test';
  process.env.DB_NAME = scratchDatabase;
  process.env.SMTP_HOST = '';
  process.env.SMTP_USER = '';
  process.env.SMTP_PASSWORD = '';
  process.env.SMTP_FROM_EMAIL = '';
  process.env.JWT_SECRET ||= 'order-ship-db-smoke-secret';

  const [orders, db] = await Promise.all([
    import('../src/modules/orders/orders.service.js'),
    import('../src/db/pool.js'),
  ]);
  pool = db.pool;

  const [[actor], [category]] = await Promise.all([
    pool.query('SELECT id FROM users ORDER BY id ASC LIMIT 1').then(([rows]) => rows),
    pool.query('SELECT id FROM categories ORDER BY id ASC LIMIT 1').then(([rows]) => rows),
  ]);
  assert.ok(actor?.id, 'The scratch schema must contain a bootstrap user.');
  assert.ok(category?.id, 'The scratch schema must contain a category.');

  const [articleInsert] = await pool.execute(
    `
      INSERT INTO articles (
        internal_code,
        slug,
        title,
        category_id,
        sale_price,
        intake_date,
        status
      ) VALUES (?, ?, 'Ship concurrency article', ?, 100, CURRENT_DATE, 'ACTIVE')
    `,
    [
      `SHIP-SMOKE-${process.pid}`,
      `ship-smoke-${process.pid}`,
      category.id,
    ],
  );
  const articleId = Number(articleInsert.insertId);
  await pool.execute(
    `
      INSERT INTO article_inventory (
        article_id,
        quantity_total,
        quantity_available,
        quantity_reserved,
        quantity_sold,
        quantity_lost,
        updated_by
      ) VALUES (?, 100, 40, 0, 60, 0, ?)
    `,
    [articleId, actor.id],
  );

  let orderSequence = 0;
  async function createOrder(orderStatus) {
    orderSequence += 1;
    const orderNumber = `SHIP-${process.pid}-${orderSequence}`;
    const [orderInsert] = await pool.execute(
      `
        INSERT INTO orders (
          order_number,
          user_id,
          payment_method,
          payment_status,
          order_status,
          subtotal_snapshot,
          total_snapshot,
          customer_first_name_snapshot,
          customer_last_name_snapshot,
          customer_email_snapshot,
          approved_at,
          created_by,
          updated_by
        ) VALUES (?, ?, 'BANK_TRANSFER', 'PAID', ?, 100, 100,
          'Ship', 'Smoke', ?, ?, ?, ?)
      `,
      [
        orderNumber,
        actor.id,
        orderStatus,
        `ship-${process.pid}@example.invalid`,
        orderStatus === 'APPROVED' ? new Date() : null,
        actor.id,
        actor.id,
      ],
    );
    const orderId = Number(orderInsert.insertId);

    await pool.execute(
      `
        INSERT INTO order_items (
          order_id,
          article_id,
          quantity,
          article_title_snapshot,
          sale_price_snapshot,
          final_unit_price_snapshot,
          line_total_snapshot
        ) VALUES (?, ?, 1, 'Ship concurrency article', 100, 100, 100)
      `,
      [orderId, articleId],
    );
    return orderId;
  }

  async function getInventory() {
    const [rows] = await pool.execute(
      `
        SELECT
          quantity_total AS quantityTotal,
          quantity_available AS quantityAvailable,
          quantity_reserved AS quantityReserved,
          quantity_sold AS quantitySold,
          quantity_lost AS quantityLost
        FROM article_inventory
        WHERE article_id = ?
      `,
      [articleId],
    );
    return Object.fromEntries(
      Object.entries(rows[0]).map(([key, value]) => [key, Number(value)]),
    );
  }

  function assertInventoryInvariant(inventory) {
    assert.equal(
      inventory.quantityTotal,
      inventory.quantityAvailable
        + inventory.quantityReserved
        + inventory.quantitySold
        + inventory.quantityLost,
    );
  }

  async function getShipCounts(orderId) {
    const [rows] = await pool.execute(
      `
        SELECT
          (
            SELECT COUNT(*)
            FROM order_status_history
            WHERE order_id = ? AND to_status = 'SHIPPED'
          ) AS historyCount,
          (
            SELECT COUNT(*)
            FROM audit_log
            WHERE entity_type = 'orders'
              AND entity_id = ?
              AND action_code = 'ORDER_SHIPPED'
          ) AS auditCount
      `,
      [orderId, orderId],
    );
    return {
      historyCount: Number(rows[0].historyCount),
      auditCount: Number(rows[0].auditCount),
    };
  }

  const emailCounts = new Map();
  const emailCommitChecks = [];
  const dependencies = {
    sendShippedOrderEmail(order) {
      emailCounts.set(order.id, Number(emailCounts.get(order.id) || 0) + 1);
      const commitCheck = (async () => {
        const [rows] = await pool.execute(
          'SELECT order_status AS orderStatus FROM orders WHERE id = ?',
          [order.id],
        );
        assert.equal(rows[0].orderStatus, 'SHIPPED');
        assert.deepEqual(await getShipCounts(order.id), {
          historyCount: 1,
          auditCount: 1,
        });
        return { accepted: true };
      })();
      emailCommitChecks.push(commitCheck);
      return commitCheck;
    },
  };

  async function flushEmailChecks() {
    const pending = emailCommitChecks.splice(0);
    await Promise.all(pending);
  }

  const auditContext = {
    actorUserId: actor.id,
    actorLabel: 'order-ship-db-smoke',
    source: 'BACKOFFICE',
    ipAddress: null,
    userAgent: 'order-ship-db-smoke',
    publicSiteUrl: 'https://example.invalid',
  };
  const inventoryBaseline = clone(await getInventory());
  assertInventoryInvariant(inventoryBaseline);

  const ship01Id = await createOrder('APPROVED');
  const ship01 = await orders.shipOrder(ship01Id, auditContext, dependencies);
  await flushEmailChecks();
  assert.equal(ship01.orderStatus, 'SHIPPED');
  assert.deepEqual(await getShipCounts(ship01Id), {
    historyCount: 1,
    auditCount: 1,
  });
  assert.equal(emailCounts.get(ship01Id), 1);

  const ship02Id = await createOrder('APPROVED');
  const ship02First = await orders.shipOrder(ship02Id, auditContext, dependencies);
  const ship02Second = await orders.shipOrder(ship02Id, auditContext, dependencies);
  await flushEmailChecks();
  assert.equal(ship02First.orderStatus, 'SHIPPED');
  assert.equal(ship02Second.orderStatus, 'SHIPPED');
  assert.deepEqual(await getShipCounts(ship02Id), {
    historyCount: 1,
    auditCount: 1,
  });
  assert.equal(emailCounts.get(ship02Id), 1);

  const ship03Id = await createOrder('APPROVED');
  const ship03Settled = await Promise.allSettled([
    orders.shipOrder(ship03Id, auditContext, dependencies),
    orders.shipOrder(ship03Id, auditContext, dependencies),
  ]);
  await flushEmailChecks();
  assert.equal(
    ship03Settled.filter(({ status }) => status === 'fulfilled').length,
    2,
  );
  assert.deepEqual(await getShipCounts(ship03Id), {
    historyCount: 1,
    auditCount: 1,
  });
  assert.equal(emailCounts.get(ship03Id), 1);

  const ship04Ids = await Promise.all(
    Array.from({ length: 16 }, () => createOrder('APPROVED')),
  );
  const ship04Settled = await Promise.all(
    ship04Ids.map((orderId) =>
      Promise.allSettled([
        orders.shipOrder(orderId, auditContext, dependencies),
        orders.shipOrder(orderId, auditContext, dependencies),
      ])),
  );
  await flushEmailChecks();
  const ship04Counts = await Promise.all(ship04Ids.map(getShipCounts));
  const doubleFulfilledCount = ship04Settled.filter((results) =>
    results.every(({ status }) => status === 'fulfilled')).length;
  const duplicateHistoryCount = ship04Counts.filter(
    ({ historyCount }) => historyCount > 1,
  ).length;
  const duplicateAuditCount = ship04Counts.filter(
    ({ auditCount }) => auditCount > 1,
  ).length;
  const duplicateEmailCount = ship04Ids.filter(
    (orderId) => Number(emailCounts.get(orderId) || 0) > 1,
  ).length;
  assert.equal(doubleFulfilledCount, 16);
  assert.equal(duplicateHistoryCount, 0);
  assert.equal(duplicateAuditCount, 0);
  assert.equal(duplicateEmailCount, 0);

  for (const invalidStatus of ['RESERVED', 'CANCELLED', 'EXPIRED']) {
    const orderId = await createOrder(invalidStatus);
    await assert.rejects(
      () => orders.shipOrder(orderId, auditContext, dependencies),
      /Solo se pueden marcar como enviadas las órdenes aprobadas/,
    );
    assert.deepEqual(await getShipCounts(orderId), {
      historyCount: 0,
      auditCount: 0,
    });
    assert.equal(Number(emailCounts.get(orderId) || 0), 0);
  }

  const ship08Id = await createOrder('APPROVED');
  const ship08First = await orders.batchUpdateOrders(
    { action: 'SHIP', ids: [ship08Id] },
    auditContext,
    dependencies,
  );
  const ship08Second = await orders.batchUpdateOrders(
    { action: 'SHIP', ids: [ship08Id] },
    auditContext,
    dependencies,
  );
  await flushEmailChecks();
  assert.deepEqual(
    [
      ship08First.succeeded,
      ship08First.failed,
      ship08Second.succeeded,
      ship08Second.failed,
    ],
    [1, 0, 1, 0],
  );
  assert.deepEqual(await getShipCounts(ship08Id), {
    historyCount: 1,
    auditCount: 1,
  });
  assert.equal(emailCounts.get(ship08Id), 1);

  const inventoryAfter = await getInventory();
  assert.deepEqual(inventoryAfter, inventoryBaseline);
  assertInventoryInvariant(inventoryAfter);

  process.stdout.write('SHIP_DB_SMOKE=PASS\n');
  process.stdout.write('SHIP_CONCURRENT_DOUBLE_FULFILLED=2\n');
  process.stdout.write(
    `SHIP_CONCURRENT_16_DOUBLE_FULFILLED_ORDER_COUNT=${doubleFulfilledCount}\n`,
  );
  process.stdout.write(`DUPLICATE_SHIPPED_HISTORY_ORDER_COUNT=${duplicateHistoryCount}\n`);
  process.stdout.write(`DUPLICATE_SHIPPED_AUDIT_ORDER_COUNT=${duplicateAuditCount}\n`);
  process.stdout.write(`DUPLICATE_EMAIL_SIDE_EFFECT_COUNT=${duplicateEmailCount}\n`);
  process.stdout.write('SHIP_STOCK_DELTA=0\n');
} catch (error) {
  primaryError = error;
  throw error;
} finally {
  const cleanupErrors = [];

  if (pool) {
    try {
      await pool.end();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }

  try {
    await runMysqlScript(
      `DROP DATABASE IF EXISTS \`${scratchDatabase}\`;`,
      {
        selectDatabase: false,
        stdout: null,
        stderr: null,
      },
    );
  } catch (error) {
    cleanupErrors.push(error);
  }

  if (cleanupErrors.length > 0) {
    if (primaryError) {
      process.stderr.write(
        `Order ship DB smoke cleanup warning: ${cleanupErrors
          .map((error) => error.message)
          .join(' | ')}\n`,
      );
    } else {
      throw cleanupErrors[0];
    }
  }
}
