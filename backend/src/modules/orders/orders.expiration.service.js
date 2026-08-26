import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { buildSqlLimitClause } from '../../utils/sql-safety.js';
import { logAudit } from '../audit/audit.service.js';
import { lockInventoryOperationsCanonical } from '../inventory/inventory-lock-order.js';
import { releaseReservation } from '../inventory/inventory.service.js';
import { restoreUsedOffersForOrder } from '../offers/offers.service.js';

function toMysqlDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function isEligibleForExpiration(order) {
  if (!order) return false;
  if (order.orderStatus !== 'RESERVED') return false;
  if (!['PENDING', 'FAILED'].includes(order.paymentStatus)) return false;
  return Number(order.reservationExpired) === 1;
}

function reportOrderFailure(orderId, error) {
  console.error('[orders] reservation expiration failed', {
    orderId: Number(orderId),
    code: error?.code || error?.name || 'ERROR',
  });
}

async function expireReservedOrdersWithDependencies(
  { now = new Date(), limit = 100, auditContext = {} } = {},
  dependencyOverrides = {},
) {
  const dependencies = {
    candidateConnection: pool,
    transactionPool: pool,
    lockInventoryOperationsCanonical,
    releaseReservation,
    restoreUsedOffersForOrder,
    logAudit,
    reportOrderFailure,
    ...dependencyOverrides,
  };
  const limitClause = buildSqlLimitClause(limit, 100, 500);
  const nowDate = now instanceof Date ? now : new Date(now);
  const nowSql = toMysqlDateTime(nowDate);

  const [candidates] = await dependencies.candidateConnection.execute(
    `
      SELECT id
      FROM orders
      WHERE order_status = 'RESERVED'
        AND payment_status IN ('PENDING', 'FAILED')
        AND reserved_until IS NOT NULL
        AND reserved_until < ?
      ORDER BY reserved_until ASC, id ASC
      ${limitClause}
    `,
    [nowSql],
  );

  const expiredOrderIds = [];
  let skippedCount = 0;
  let failedCount = 0;

  for (const candidate of candidates) {
    try {
      const result = await withTransaction(async (connection) => {
        const [orders] = await connection.execute(
          `
            SELECT
              id,
              order_status AS orderStatus,
              payment_status AS paymentStatus,
              reserved_until AS reservedUntil,
              (
                reserved_until IS NOT NULL
                AND reserved_until < ?
              ) AS reservationExpired
            FROM orders
            WHERE id = ?
            LIMIT 1
            FOR UPDATE
          `,
          [nowSql, candidate.id],
        );
        const order = orders[0] || null;

        if (!isEligibleForExpiration(order)) {
          return { status: 'SKIPPED' };
        }

        const [items] = await connection.execute(
          `
            SELECT
              article_id AS articleId,
              SUM(quantity) AS quantity
            FROM order_items
            WHERE order_id = ?
              AND article_id IS NOT NULL
            GROUP BY article_id
          `,
          [order.id],
        );

        const inventoryOperations =
          await dependencies.lockInventoryOperationsCanonical(
            connection,
            items.map((item) => ({
              articleId: Number(item.articleId),
              quantity: Number(item.quantity || 0),
            })),
          );

        for (const item of inventoryOperations) {
          await dependencies.releaseReservation(connection, {
            articleId: item.articleId,
            quantity: item.quantity,
            orderId: Number(order.id),
            userId: auditContext.actorUserId || null,
            reason: 'Reserva vencida',
          });
        }

        const [orderUpdateResult] = await connection.execute(
          `
            UPDATE orders
            SET
              order_status = 'EXPIRED',
              updated_by = ?
            WHERE id = ?
              AND order_status = 'RESERVED'
              AND payment_status IN ('PENDING', 'FAILED')
          `,
          [auditContext.actorUserId || null, order.id],
        );

        if (!orderUpdateResult.affectedRows) {
          const error = new Error(
            'La orden no pudo marcarse como vencida después de revalidarla.',
          );
          error.code = 'ORDER_EXPIRATION_UPDATE_CONFLICT';
          throw error;
        }

        await dependencies.restoreUsedOffersForOrder(connection, {
          orderId: order.id,
          auditContext,
          reason: 'Reserva vencida; oferta disponible nuevamente',
        });

        await connection.execute(
          `
            INSERT INTO order_status_history (
              order_id,
              from_status,
              to_status,
              reason,
              changed_by,
              source
            ) VALUES (?, ?, 'EXPIRED', 'Reserva vencida', ?, ?)
          `,
          [
            order.id,
            order.orderStatus,
            auditContext.actorUserId || null,
            auditContext.source || 'SYSTEM',
          ],
        );

        await dependencies.logAudit(
          {
            actorUserId: auditContext.actorUserId || null,
            actorLabel: auditContext.actorLabel || null,
            actionCode: 'ORDER_RESERVATION_EXPIRED',
            entityType: 'orders',
            entityId: order.id,
            beforeJson: { orderStatus: order.orderStatus },
            afterJson: { orderStatus: 'EXPIRED' },
            metadataJson: { reason: 'Reserva vencida' },
            source: auditContext.source || 'SYSTEM',
            ipAddress: auditContext.ipAddress || null,
            userAgent: auditContext.userAgent || null,
          },
          connection,
        );

        return {
          status: 'EXPIRED',
          orderId: Number(order.id),
        };
      }, dependencies.transactionPool);

      if (result.status === 'EXPIRED') {
        expiredOrderIds.push(result.orderId);
      } else {
        skippedCount += 1;
      }
    } catch (error) {
      failedCount += 1;
      try {
        await dependencies.reportOrderFailure(candidate.id, error);
      } catch {
        reportOrderFailure(candidate.id, {
          code: 'EXPIRATION_FAILURE_REPORT_ERROR',
        });
      }
    }
  }

  return {
    expiredCount: expiredOrderIds.length,
    orderIds: expiredOrderIds,
    scannedCount: candidates.length,
    skippedCount,
    failedCount,
  };
}

export async function expireReservedOrders(options = {}) {
  return expireReservedOrdersWithDependencies(options);
}

export const expirationTestInternals = {
  expireReservedOrdersWithDependencies,
  isEligibleForExpiration,
};
