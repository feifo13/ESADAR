// Deprecated compatibility layer. Inventory mutations live in ../inventory.
import {
  adjustInventory,
  confirmSale,
  getInventoryByArticleId,
  recordInventoryMovement,
  releaseReservation,
  reserveForOrder,
} from '../inventory/inventory.service.js';
import { deriveStockStatus } from '../inventory/inventory.constants.js';

export function recalculateArticleStockStatus(inventory) {
  return deriveStockStatus(inventory);
}

export function getArticleStockByArticleId(connection, articleId) {
  return getInventoryByArticleId(connection, articleId);
}

export function recordArticleStockMovement(connection, payload) {
  return recordInventoryMovement(connection, payload);
}

export function applyManualStockAdjustment(connection, articleId, payload, auditContext = {}) {
  return adjustInventory(connection, {
    articleId,
    quantityTotal: payload.quantityTotal,
    quantityAvailable: payload.quantityAvailable,
    quantityReserved: payload.quantityReserved,
    quantitySold: payload.quantitySold,
    quantityLost: payload.quantityLost,
    reason: payload.reason || 'Ajuste manual desde edicion de articulo',
    userId: auditContext.actorUserId || payload.userId || null,
  });
}

export function reserveArticleStockForOrder(connection, {
  articleId,
  quantity,
  orderId,
  auditContext = {},
  reason,
}) {
  return reserveForOrder(connection, {
    articleId,
    quantity,
    orderId,
    reason,
    userId: auditContext.actorUserId || null,
  });
}

export function releaseArticleStockFromOrder(connection, {
  articleId,
  quantity,
  orderId,
  auditContext = {},
  reason,
}) {
  return releaseReservation(connection, {
    articleId,
    quantity,
    orderId,
    reason,
    userId: auditContext.actorUserId || null,
  });
}

export function markReservedStockAsSold(connection, {
  articleId,
  quantity,
  orderId,
  auditContext = {},
  reason,
}) {
  return confirmSale(connection, {
    articleId,
    quantity,
    orderId,
    reason,
    userId: auditContext.actorUserId || null,
  });
}
