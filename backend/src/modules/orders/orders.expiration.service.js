import { withTransaction } from '../../db/transaction.js';
import { logAudit } from '../audit/audit.service.js';
import { releaseArticleStockFromOrder } from '../articles/article-stock.service.js';
import { restoreUsedOffersForOrder } from '../offers/offers.service.js';

function normalizeLimit(limit) {
  const numeric = Number(limit || 100);
  if (!Number.isFinite(numeric) || numeric <= 0) return 100;
  return Math.min(Math.floor(numeric), 500);
}

function toMysqlDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export async function expireReservedOrders({ now = new Date(), limit = 100, auditContext = {} } = {}) {
  const safeLimit = normalizeLimit(limit);
  const nowSql = toMysqlDateTime(now);

  return withTransaction(async (connection) => {
    const [orders] = await connection.query(
      `
        SELECT
          id,
          order_status AS orderStatus
        FROM orders
        WHERE order_status = 'RESERVED'
          AND payment_status = 'PENDING'
          AND reserved_until IS NOT NULL
          AND reserved_until < ?
        ORDER BY reserved_until ASC, id ASC
        LIMIT ${safeLimit}
        FOR UPDATE
      `,
      [nowSql],
    );

    const expiredOrderIds = [];

    for (const order of orders) {
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

      for (const item of items) {
        await releaseArticleStockFromOrder(connection, {
          articleId: Number(item.articleId),
          quantity: Number(item.quantity || 0),
          orderId: Number(order.id),
          auditContext,
          reason: 'Reserva vencida',
          movementType: 'RELEASE_RESERVATION',
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
            AND payment_status = 'PENDING'
        `,
        [auditContext.actorUserId || null, order.id],
      );

      if (!orderUpdateResult.affectedRows) {
        continue;
      }

      await restoreUsedOffersForOrder(connection, {
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

      await logAudit(
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

      expiredOrderIds.push(Number(order.id));
    }

    return {
      expiredCount: expiredOrderIds.length,
      orderIds: expiredOrderIds,
    };
  });
}
