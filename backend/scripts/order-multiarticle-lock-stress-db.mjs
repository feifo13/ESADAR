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

const STRESS_ROUNDS = 10;
const ORDERS_PER_ROUND = 24;
const scratchDatabase = `esadar_codex_inventory_lock_stress_${process.pid}`;
const currentDir = dirname(fileURLToPath(import.meta.url));
const dbHost = String(process.env.DB_HOST || '').trim().toLowerCase();

if (!['127.0.0.1', 'localhost', '::1'].includes(dbHost)) {
  throw new Error(
    'Inventory lock stress refuses to run against a non-local database host.',
  );
}
if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
  throw new Error('Inventory lock stress refuses to run in production mode.');
}

let pool;
let primaryError = null;

function sqlPlaceholders(values) {
  assert.ok(values.length > 0);
  return values.map(() => '?').join(', ');
}

function groupArticleIdsByOrder(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const orderId = Number(row.orderId);
    const articleIds = grouped.get(orderId) || [];
    articleIds.push(Number(row.articleId));
    grouped.set(orderId, articleIds);
  }
  return grouped;
}

function isDeadlock(error) {
  return error?.code === 'ER_LOCK_DEADLOCK'
    || Number(error?.errno) === 1213;
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
      email: `inventory-lock-${process.pid}@example.invalid`,
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
  process.env.MERCADO_PAGO_PUBLIC_KEY = '';
  process.env.MERCADO_PAGO_ACCESS_TOKEN = '';
  process.env.MERCADO_PAGO_CHECKOUT_URL = '';
  process.env.JWT_SECRET ||= 'inventory-lock-stress-secret';

  const [orders, expiration, schemas, db] = await Promise.all([
    import('../src/modules/orders/orders.service.js'),
    import('../src/modules/orders/orders.expiration.service.js'),
    import('../src/modules/orders/orders.schemas.js'),
    import('../src/db/pool.js'),
  ]);
  pool = db.pool;

  const [[actor], [category], [shipping]] = await Promise.all([
    pool.query('SELECT id FROM users ORDER BY id ASC LIMIT 1').then(([rows]) => rows),
    pool.query('SELECT id FROM categories ORDER BY id ASC LIMIT 1').then(([rows]) => rows),
    pool.query(
      'SELECT id FROM shipping_methods WHERE is_active = 1 ORDER BY id ASC LIMIT 1',
    ).then(([rows]) => rows),
  ]);
  assert.ok(actor?.id);
  assert.ok(category?.id);
  assert.ok(shipping?.id);

  async function createArticle(code) {
    const normalizedCode = `LOCK-${code}-${process.pid}`;
    const [insertResult] = await pool.execute(
      `
        INSERT INTO articles (
          internal_code,
          slug,
          title,
          category_id,
          sale_price,
          intake_date,
          status
        ) VALUES (?, ?, ?, ?, 100, CURRENT_DATE, 'ACTIVE')
      `,
      [
        normalizedCode,
        normalizedCode.toLowerCase(),
        `Inventory lock article ${code}`,
        category.id,
      ],
    );
    const articleId = Number(insertResult.insertId);
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
        ) VALUES (?, 1000, 1000, 0, 0, 0, ?)
      `,
      [articleId, actor.id],
    );
    return articleId;
  }

  const articleA = await createArticle('A');
  const articleB = await createArticle('B');
  assert.ok(articleA < articleB);

  const auditContext = {
    actorUserId: actor.id,
    actorLabel: 'inventory-lock-stress',
    source: 'BACKOFFICE',
    ipAddress: null,
    userAgent: 'inventory-lock-stress',
    publicSiteUrl: 'https://example.invalid',
  };
  const guest = {
    firstName: 'Lock',
    lastName: 'Stress',
    email: `inventory-lock-${process.pid}@example.invalid`,
    phone: '+598 99 123 456',
    address: {
      addressLine: 'Avenida de prueba 1234',
      city: 'Montevideo',
      state: 'Montevideo',
      country: 'Uruguay',
      postalCode: '11600',
      dwellingType: 'HOUSE',
      apartment: null,
      deliveryNotes: null,
    },
  };

  async function createReservedOrder(articleIds) {
    return orders.createOrder(
      schemas.createOrderSchema.parse({
        shippingMethodId: shipping.id,
        paymentMethod: 'BANK_TRANSFER',
        items: articleIds.map((articleId) => ({ articleId, quantity: 1 })),
        guest,
      }),
      {},
      auditContext,
    );
  }

  async function removeOrderEmailRecipients(orderIds) {
    const placeholders = sqlPlaceholders(orderIds);
    await pool.execute(
      `UPDATE orders SET customer_email_snapshot = NULL WHERE id IN (${placeholders})`,
      orderIds,
    );
    await pool.execute(
      `
        UPDATE potential_customers
        SET email = NULL
        WHERE id IN (
          SELECT potential_customer_id
          FROM orders
          WHERE id IN (${placeholders})
        )
      `,
      orderIds,
    );
  }

  async function getMovementCounts(orderId) {
    const [rows] = await pool.execute(
      `
        SELECT
          SUM(movement_type = 'RESERVE') AS reserveCount,
          SUM(movement_type = 'SALE') AS saleCount,
          SUM(movement_type = 'RELEASE_RESERVATION') AS releaseCount
        FROM article_inventory_movements
        WHERE order_id = ?
      `,
      [orderId],
    );
    return {
      reserveCount: Number(rows[0].reserveCount || 0),
      saleCount: Number(rows[0].saleCount || 0),
      releaseCount: Number(rows[0].releaseCount || 0),
    };
  }

  let totalApprovedCount = 0;
  let totalDeadlockCount = 0;
  let totalUnexpectedRejectCount = 0;
  let totalReservedRollbackCount = 0;
  const stressOrderIds = [];

  for (let round = 0; round < STRESS_ROUNDS; round += 1) {
    const roundOrders = [];
    const expectedPersistedOrder = new Map();

    for (let index = 0; index < ORDERS_PER_ROUND; index += 1) {
      const requestedOrder = index < ORDERS_PER_ROUND / 2
        ? [articleA, articleB]
        : [articleB, articleA];
      const order = await createReservedOrder(requestedOrder);
      roundOrders.push(order);
      expectedPersistedOrder.set(Number(order.id), requestedOrder);
    }

    const roundOrderIds = roundOrders.map(({ id }) => Number(id));
    stressOrderIds.push(...roundOrderIds);
    await removeOrderEmailRecipients(roundOrderIds);

    for (const order of roundOrders) {
      assert.deepEqual(
        order.items.map(({ articleId }) => Number(articleId)),
        expectedPersistedOrder.get(Number(order.id)),
      );
    }

    const placeholders = sqlPlaceholders(roundOrderIds);
    const [reserveMovementRows] = await pool.execute(
      `
        SELECT
          order_id AS orderId,
          article_id AS articleId
        FROM article_inventory_movements
        WHERE order_id IN (${placeholders})
          AND movement_type = 'RESERVE'
        ORDER BY order_id ASC, id ASC
      `,
      roundOrderIds,
    );
    const reserveOrderByOrder = groupArticleIdsByOrder(reserveMovementRows);
    for (const orderId of roundOrderIds) {
      assert.deepEqual(reserveOrderByOrder.get(orderId), [articleA, articleB]);
    }

    const settled = await Promise.allSettled(
      roundOrderIds.map((orderId) =>
        orders.approveOrder(orderId, auditContext)),
    );
    totalApprovedCount += settled.filter(
      ({ status }) => status === 'fulfilled',
    ).length;
    totalDeadlockCount += settled.filter(
      ({ status, reason }) => status === 'rejected' && isDeadlock(reason),
    ).length;
    totalUnexpectedRejectCount += settled.filter(
      ({ status, reason }) => status === 'rejected' && !isDeadlock(reason),
    ).length;

    const [rollbackRows] = await pool.execute(
      `
        SELECT COUNT(*) AS total
        FROM orders
        WHERE id IN (${placeholders})
          AND order_status = 'RESERVED'
      `,
      roundOrderIds,
    );
    totalReservedRollbackCount += Number(rollbackRows[0].total);
  }

  const stressPlaceholders = sqlPlaceholders(stressOrderIds);
  const [movementSummaryRows] = await pool.execute(
    `
      SELECT
        order_id AS orderId,
        SUM(movement_type = 'RESERVE') AS reserveCount,
        SUM(movement_type = 'SALE') AS saleCount,
        SUM(movement_type = 'RELEASE_RESERVATION') AS releaseCount
      FROM article_inventory_movements
      WHERE order_id IN (${stressPlaceholders})
      GROUP BY order_id
      ORDER BY order_id ASC
    `,
    stressOrderIds,
  );
  assert.equal(movementSummaryRows.length, stressOrderIds.length);
  for (const row of movementSummaryRows) {
    assert.deepEqual(
      {
        reserveCount: Number(row.reserveCount),
        saleCount: Number(row.saleCount),
        releaseCount: Number(row.releaseCount),
      },
      { reserveCount: 2, saleCount: 2, releaseCount: 0 },
    );
  }

  const cancelOrder = await createReservedOrder([articleB, articleA]);
  await removeOrderEmailRecipients([Number(cancelOrder.id)]);
  const cancelled = await orders.cancelOrder(
    cancelOrder.id,
    'Cancel lock stress',
    auditContext,
  );
  assert.equal(cancelled.orderStatus, 'CANCELLED');
  assert.deepEqual(await getMovementCounts(cancelOrder.id), {
    reserveCount: 2,
    saleCount: 0,
    releaseCount: 2,
  });

  const expireOrder = await createReservedOrder([articleB, articleA]);
  await removeOrderEmailRecipients([Number(expireOrder.id)]);
  await pool.execute(
    `
      UPDATE orders
      SET reserved_until = DATE_SUB(NOW(), INTERVAL 1 HOUR)
      WHERE id = ?
    `,
    [expireOrder.id],
  );
  const expired = await expiration.expireReservedOrders({
    now: new Date(),
    limit: 100,
    auditContext,
  });
  assert.equal(expired.expiredCount, 1);
  assert.deepEqual(expired.orderIds, [Number(expireOrder.id)]);
  assert.deepEqual(await getMovementCounts(expireOrder.id), {
    reserveCount: 2,
    saleCount: 0,
    releaseCount: 2,
  });

  const [inventoryRows] = await pool.execute(
    `
      SELECT
        quantity_total AS quantityTotal,
        quantity_available AS quantityAvailable,
        quantity_reserved AS quantityReserved,
        quantity_sold AS quantitySold,
        quantity_lost AS quantityLost
      FROM article_inventory
      WHERE article_id IN (?, ?)
      ORDER BY article_id ASC
    `,
    [articleA, articleB],
  );
  const stockInvariantViolationCount = inventoryRows.filter((row) =>
    Number(row.quantityTotal)
      !== Number(row.quantityAvailable)
        + Number(row.quantityReserved)
        + Number(row.quantitySold)
        + Number(row.quantityLost)).length;
  const negativeInventoryRowCount = inventoryRows.filter((row) =>
    Number(row.quantityAvailable) < 0
      || Number(row.quantityReserved) < 0
      || Number(row.quantitySold) < 0
      || Number(row.quantityLost) < 0).length;

  const [orphanRows] = await pool.execute(
    `
      SELECT COUNT(*) AS total
      FROM article_inventory_movements aim
      LEFT JOIN articles a ON a.id = aim.article_id
      LEFT JOIN orders o ON o.id = aim.order_id
      WHERE a.id IS NULL
        OR (aim.order_id IS NOT NULL AND o.id IS NULL)
    `,
  );
  const orphanMovementCount = Number(orphanRows[0].total);

  assert.equal(totalApprovedCount, STRESS_ROUNDS * ORDERS_PER_ROUND);
  assert.equal(totalDeadlockCount, 0);
  assert.equal(totalUnexpectedRejectCount, 0);
  assert.equal(totalReservedRollbackCount, 0);
  assert.equal(stockInvariantViolationCount, 0);
  assert.equal(negativeInventoryRowCount, 0);
  assert.equal(orphanMovementCount, 0);

  process.stdout.write(`STRESS_ROUNDS=${STRESS_ROUNDS}\n`);
  process.stdout.write(`ORDERS_PER_ROUND=${ORDERS_PER_ROUND}\n`);
  process.stdout.write(
    `TOTAL_CONCURRENT_APPROVALS=${STRESS_ROUNDS * ORDERS_PER_ROUND}\n`,
  );
  process.stdout.write(`TOTAL_APPROVED_COUNT=${totalApprovedCount}\n`);
  process.stdout.write(`TOTAL_DEADLOCK_COUNT=${totalDeadlockCount}\n`);
  process.stdout.write(
    `TOTAL_UNEXPECTED_REJECT_COUNT=${totalUnexpectedRejectCount}\n`,
  );
  process.stdout.write(
    `TOTAL_RESERVED_ROLLBACK_COUNT=${totalReservedRollbackCount}\n`,
  );
  process.stdout.write(
    `STOCK_INVARIANT_VIOLATION_COUNT=${stockInvariantViolationCount}\n`,
  );
  process.stdout.write(
    `NEGATIVE_INVENTORY_ROW_COUNT=${negativeInventoryRowCount}\n`,
  );
  process.stdout.write(`ORPHAN_MOVEMENT_COUNT=${orphanMovementCount}\n`);
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
        `Inventory lock stress cleanup warning: ${cleanupErrors
          .map((error) => error.message)
          .join(' | ')}\n`,
      );
    } else {
      throw cleanupErrors[0];
    }
  }
}
