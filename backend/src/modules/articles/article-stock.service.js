import { badRequest, notFound } from '../../utils/app-error.js';
import { logAudit } from '../audit/audit.service.js';

function normalizeStockQuantity(value, fieldLabel) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric < 0) {
    throw badRequest(`${fieldLabel} no puede ser negativo.`);
  }
  return numeric;
}

function toStockSnapshot(row) {
  if (!row) return null;

  return {
    id: Number(row.id),
    articleId: Number(row.articleId || row.id),
    quantityTotal: Number(row.quantityTotal || 0),
    quantityAvailable: Number(row.quantityAvailable || 0),
    quantityReserved: Number(row.quantityReserved || 0),
    quantitySold: Number(row.quantitySold || 0),
    status: row.status,
  };
}

export function recalculateArticleStockStatus(article, options = {}) {
  const preserveInactive = options.preserveInactive !== false;
  const quantityAvailable = Number(article.quantityAvailable || 0);
  const quantityReserved = Number(article.quantityReserved || 0);
  const quantitySold = Number(article.quantitySold || 0);

  if (preserveInactive && article.status === 'INACTIVE') {
    return 'INACTIVE';
  }

  if (quantityAvailable > 0) {
    return 'ACTIVE';
  }

  if (quantityReserved > 0) {
    return 'RESERVED';
  }

  if (quantitySold > 0) {
    return 'SOLD_OUT';
  }

  return article.status === 'INACTIVE' ? 'INACTIVE' : 'SOLD_OUT';
}

export function assertValidArticleStock(article) {
  const quantityTotal = normalizeStockQuantity(article.quantityTotal, 'El stock total');
  const quantityAvailable = normalizeStockQuantity(article.quantityAvailable, 'El stock disponible');
  const quantityReserved = normalizeStockQuantity(article.quantityReserved, 'El stock reservado');
  const quantitySold = normalizeStockQuantity(article.quantitySold, 'El stock vendido');

  if (quantityTotal < quantityAvailable + quantityReserved + quantitySold) {
    throw badRequest('El stock total debe cubrir disponible, reservado y vendido.');
  }

  return {
    quantityTotal,
    quantityAvailable,
    quantityReserved,
    quantitySold,
  };
}

export async function getArticleStockForUpdate(connection, articleId) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        quantity_total AS quantityTotal,
        quantity_available AS quantityAvailable,
        quantity_reserved AS quantityReserved,
        quantity_sold AS quantitySold,
        status
      FROM articles
      WHERE id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [articleId],
  );

  if (!rows.length) {
    throw notFound('Articulo no encontrado.');
  }

  return toStockSnapshot(rows[0]);
}

export async function recordArticleStockMovement(connection, payload) {
  await connection.execute(
    `
      INSERT INTO article_stock_movements (
        article_id,
        movement_type,
        quantity_delta,
        from_available,
        to_available,
        from_reserved,
        to_reserved,
        from_sold,
        to_sold,
        reason,
        order_id,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.articleId,
      payload.movementType,
      payload.quantityDelta,
      payload.fromAvailable ?? null,
      payload.toAvailable ?? null,
      payload.fromReserved ?? null,
      payload.toReserved ?? null,
      payload.fromSold ?? null,
      payload.toSold ?? null,
      payload.reason || null,
      payload.orderId || null,
      payload.createdBy || null,
    ],
  );
}

export async function logArticleStatusAutoUpdate(connection, { before, after, auditContext = {}, reason, orderId = null }) {
  if (!before || !after || before.status === after.status) {
    return;
  }

  await logAudit(
    {
      actorUserId: auditContext.actorUserId || null,
      actorLabel: auditContext.actorLabel || null,
      actionCode: 'ARTICLE_STATUS_AUTO_UPDATED',
      entityType: 'articles',
      entityId: after.articleId || after.id,
      beforeJson: { status: before.status },
      afterJson: { status: after.status },
      metadataJson: {
        reason,
        orderId,
        fromStatus: before.status,
        toStatus: after.status,
      },
      source: auditContext.source || 'SYSTEM',
      ipAddress: auditContext.ipAddress || null,
      userAgent: auditContext.userAgent || null,
    },
    connection,
  );
}

async function persistStockState(connection, articleId, next, auditContext = {}) {
  assertValidArticleStock(next);

  await connection.execute(
    `
      UPDATE articles
      SET
        quantity_total = ?,
        quantity_available = ?,
        quantity_reserved = ?,
        quantity_sold = ?,
        status = ?,
        updated_by = ?
      WHERE id = ?
    `,
    [
      next.quantityTotal,
      next.quantityAvailable,
      next.quantityReserved,
      next.quantitySold,
      next.status,
      auditContext.actorUserId || null,
      articleId,
    ],
  );

  return {
    ...next,
    articleId,
    id: articleId,
  };
}

export async function applyManualStockAdjustment(connection, articleId, payload, auditContext = {}) {
  const before = await getArticleStockForUpdate(connection, articleId);
  const quantityAvailable = normalizeStockQuantity(payload.quantityAvailable, 'El stock disponible');
  const quantityReserved = before.quantityReserved;
  const quantitySold = before.quantitySold;
  const quantityTotal = Math.max(
    before.quantityTotal,
    quantityAvailable + quantityReserved + quantitySold,
  );
  const nextBase = {
    ...before,
    quantityTotal,
    quantityAvailable,
    quantityReserved,
    quantitySold,
  };
  const after = await persistStockState(
    connection,
    articleId,
    {
      ...nextBase,
      status: recalculateArticleStockStatus(nextBase),
    },
    auditContext,
  );

  if (before.quantityAvailable !== after.quantityAvailable) {
    await recordArticleStockMovement(connection, {
      articleId,
      movementType: 'MANUAL_ADJUSTMENT',
      quantityDelta: after.quantityAvailable - before.quantityAvailable,
      fromAvailable: before.quantityAvailable,
      toAvailable: after.quantityAvailable,
      fromReserved: before.quantityReserved,
      toReserved: after.quantityReserved,
      fromSold: before.quantitySold,
      toSold: after.quantitySold,
      reason: payload.reason || 'Ajuste manual desde edicion de articulo',
      createdBy: auditContext.actorUserId || null,
    });
  }

  await logArticleStatusAutoUpdate(connection, {
    before,
    after,
    auditContext,
    reason: 'Ajuste manual de stock',
  });

  return { before, after };
}

export async function reserveArticleStockForOrder(connection, { articleId, quantity, orderId, auditContext = {}, reason }) {
  const before = await getArticleStockForUpdate(connection, articleId);
  const quantityToReserve = normalizeStockQuantity(quantity, 'La cantidad a reservar');

  if (quantityToReserve <= 0) {
    throw badRequest('La cantidad a reservar debe ser mayor a cero.');
  }

  if (before.status !== 'ACTIVE' || before.quantityAvailable < quantityToReserve) {
    throw badRequest(`No hay stock suficiente para la prenda ${articleId}.`);
  }

  const nextBase = {
    ...before,
    quantityAvailable: before.quantityAvailable - quantityToReserve,
    quantityReserved: before.quantityReserved + quantityToReserve,
  };
  const after = await persistStockState(
    connection,
    articleId,
    {
      ...nextBase,
      status: recalculateArticleStockStatus(nextBase),
    },
    auditContext,
  );

  await recordArticleStockMovement(connection, {
    articleId,
    movementType: 'RESERVE',
    quantityDelta: -quantityToReserve,
    fromAvailable: before.quantityAvailable,
    toAvailable: after.quantityAvailable,
    fromReserved: before.quantityReserved,
    toReserved: after.quantityReserved,
    fromSold: before.quantitySold,
    toSold: after.quantitySold,
    reason: reason || 'Reserva por orden',
    orderId,
    createdBy: auditContext.actorUserId || null,
  });

  await logArticleStatusAutoUpdate(connection, {
    before,
    after,
    auditContext,
    reason: 'Reserva por orden',
    orderId,
  });

  return { before, after };
}

export async function releaseArticleStockFromOrder(connection, {
  articleId,
  quantity,
  orderId,
  auditContext = {},
  reason,
  movementType = 'RELEASE_RESERVATION',
}) {
  const before = await getArticleStockForUpdate(connection, articleId);
  const requestedQuantity = normalizeStockQuantity(quantity, 'La cantidad a liberar');
  const quantityToRelease = Math.min(before.quantityReserved, requestedQuantity);

  if (quantityToRelease <= 0) {
    return { before, after: before, releasedQuantity: 0 };
  }

  const nextBase = {
    ...before,
    quantityAvailable: before.quantityAvailable + quantityToRelease,
    quantityReserved: before.quantityReserved - quantityToRelease,
  };
  const after = await persistStockState(
    connection,
    articleId,
    {
      ...nextBase,
      status: recalculateArticleStockStatus(nextBase),
    },
    auditContext,
  );

  await recordArticleStockMovement(connection, {
    articleId,
    movementType,
    quantityDelta: quantityToRelease,
    fromAvailable: before.quantityAvailable,
    toAvailable: after.quantityAvailable,
    fromReserved: before.quantityReserved,
    toReserved: after.quantityReserved,
    fromSold: before.quantitySold,
    toSold: after.quantitySold,
    reason: reason || 'Liberacion de reserva',
    orderId,
    createdBy: auditContext.actorUserId || null,
  });

  await logArticleStatusAutoUpdate(connection, {
    before,
    after,
    auditContext,
    reason: reason || 'Liberacion de reserva',
    orderId,
  });

  return { before, after, releasedQuantity: quantityToRelease };
}

export async function markReservedStockAsSold(connection, { articleId, quantity, orderId, auditContext = {}, reason }) {
  const before = await getArticleStockForUpdate(connection, articleId);
  const quantityToSell = normalizeStockQuantity(quantity, 'La cantidad a vender');

  if (quantityToSell <= 0) {
    throw badRequest('La cantidad a vender debe ser mayor a cero.');
  }

  const nextBase = {
    ...before,
    quantityReserved: Math.max(before.quantityReserved - quantityToSell, 0),
    quantitySold: before.quantitySold + quantityToSell,
  };
  const after = await persistStockState(
    connection,
    articleId,
    {
      ...nextBase,
      status: recalculateArticleStockStatus(nextBase),
    },
    auditContext,
  );

  await recordArticleStockMovement(connection, {
    articleId,
    movementType: 'SALE',
    quantityDelta: quantityToSell,
    fromAvailable: before.quantityAvailable,
    toAvailable: after.quantityAvailable,
    fromReserved: before.quantityReserved,
    toReserved: after.quantityReserved,
    fromSold: before.quantitySold,
    toSold: after.quantitySold,
    reason: reason || 'Venta aprobada',
    orderId,
    createdBy: auditContext.actorUserId || null,
  });

  await logArticleStatusAutoUpdate(connection, {
    before,
    after,
    auditContext,
    reason: 'Venta aprobada',
    orderId,
  });

  return { before, after };
}
