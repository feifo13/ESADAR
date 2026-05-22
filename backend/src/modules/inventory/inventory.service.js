import { pool } from '../../db/pool.js';
import { badRequest } from '../../utils/app-error.js';
import { INVENTORY_MOVEMENT_TYPES } from './inventory.constants.js';
import {
  findInventoryByArticleId,
  getInventoryByArticleIdForUpdate,
  insertInventory,
  insertInventoryMovement,
  updateInventory,
} from './inventory.repository.js';

function normalizeIntegerQuantity(value, fieldLabel) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric < 0) {
    throw badRequest(`${fieldLabel} no puede ser negativo.`);
  }
  return numeric;
}

function normalizePositiveQuantity(value, fieldLabel) {
  const quantity = normalizeIntegerQuantity(value, fieldLabel);
  if (quantity <= 0) {
    throw badRequest(`${fieldLabel} debe ser mayor a cero.`);
  }
  return quantity;
}

function assertInventoryBalance(inventory) {
  const quantityTotal = normalizeIntegerQuantity(inventory.quantityTotal, 'El stock total');
  const quantityAvailable = normalizeIntegerQuantity(inventory.quantityAvailable, 'El stock disponible');
  const quantityReserved = normalizeIntegerQuantity(inventory.quantityReserved, 'El stock reservado');
  const quantitySold = normalizeIntegerQuantity(inventory.quantitySold, 'El stock vendido');
  const quantityLost = normalizeIntegerQuantity(inventory.quantityLost, 'El stock perdido');

  if (quantityTotal !== quantityAvailable + quantityReserved + quantitySold + quantityLost) {
    throw badRequest('El stock total debe ser igual a disponible, reservado, vendido y perdido.');
  }

  return {
    ...inventory,
    quantityTotal,
    quantityAvailable,
    quantityReserved,
    quantitySold,
    quantityLost,
  };
}

function buildMovementFromTransition({
  articleId,
  before,
  after,
  movementType,
  orderId = null,
  reason = null,
  userId = null,
}) {
  return {
    articleId,
    orderId,
    movementType,
    availableDelta: after.quantityAvailable - before.quantityAvailable,
    reservedDelta: after.quantityReserved - before.quantityReserved,
    soldDelta: after.quantitySold - before.quantitySold,
    lostDelta: after.quantityLost - before.quantityLost,
    quantityAvailableAfter: after.quantityAvailable,
    quantityReservedAfter: after.quantityReserved,
    quantitySoldAfter: after.quantitySold,
    quantityLostAfter: after.quantityLost,
    reason,
    createdBy: userId,
  };
}

export async function getInventoryByArticleId(connection = pool, articleId) {
  return findInventoryByArticleId(connection, articleId);
}

export async function recordInventoryMovement(connection, payload) {
  const movement = {
    articleId: normalizePositiveQuantity(payload.articleId, 'El articulo'),
    orderId: payload.orderId || null,
    movementType: payload.movementType,
    availableDelta: Number(payload.availableDelta || 0),
    reservedDelta: Number(payload.reservedDelta || 0),
    soldDelta: Number(payload.soldDelta || 0),
    lostDelta: Number(payload.lostDelta || 0),
    quantityAvailableAfter: normalizeIntegerQuantity(payload.quantityAvailableAfter, 'El stock disponible final'),
    quantityReservedAfter: normalizeIntegerQuantity(payload.quantityReservedAfter, 'El stock reservado final'),
    quantitySoldAfter: normalizeIntegerQuantity(payload.quantitySoldAfter, 'El stock vendido final'),
    quantityLostAfter: normalizeIntegerQuantity(payload.quantityLostAfter, 'El stock perdido final'),
    reason: payload.reason || null,
    createdBy: payload.createdBy || payload.userId || null,
  };

  if (!Object.values(INVENTORY_MOVEMENT_TYPES).includes(movement.movementType)) {
    throw badRequest('Tipo de movimiento de inventario invalido.');
  }

  await insertInventoryMovement(connection, movement);
  return movement;
}

export async function createInitialInventory(connection, {
  articleId,
  quantityTotal = 1,
  quantityAvailable = null,
  quantityReserved = 0,
  quantitySold = 0,
  quantityLost = null,
  createdBy = null,
  reason = 'Ingreso inicial',
}) {
  const normalizedReserved = normalizeIntegerQuantity(quantityReserved, 'El stock reservado');
  const normalizedSold = normalizeIntegerQuantity(quantitySold, 'El stock vendido');
  let normalizedTotal = normalizeIntegerQuantity(quantityTotal, 'El stock total');
  const normalizedAvailable = quantityAvailable == null
    ? normalizedTotal - normalizedReserved - normalizedSold
    : normalizeIntegerQuantity(quantityAvailable, 'El stock disponible');
  const normalizedLost = quantityLost == null
    ? normalizedTotal - normalizedAvailable - normalizedReserved - normalizedSold
    : normalizeIntegerQuantity(quantityLost, 'El stock perdido');

  if (normalizedLost < 0) {
    throw badRequest('El stock total debe cubrir disponible, reservado y vendido.');
  }

  normalizedTotal = normalizedAvailable + normalizedReserved + normalizedSold + normalizedLost;

  const inventory = assertInventoryBalance({
    articleId: normalizePositiveQuantity(articleId, 'El articulo'),
    quantityTotal: normalizedTotal,
    quantityAvailable: normalizedAvailable,
    quantityReserved: normalizedReserved,
    quantitySold: normalizedSold,
    quantityLost: normalizedLost,
    updatedBy: createdBy || null,
  });

  await insertInventory(connection, inventory);
  await recordInventoryMovement(connection, {
    articleId: inventory.articleId,
    movementType: INVENTORY_MOVEMENT_TYPES.INITIAL_STOCK,
    availableDelta: inventory.quantityAvailable,
    reservedDelta: inventory.quantityReserved,
    soldDelta: inventory.quantitySold,
    lostDelta: inventory.quantityLost,
    quantityAvailableAfter: inventory.quantityAvailable,
    quantityReservedAfter: inventory.quantityReserved,
    quantitySoldAfter: inventory.quantitySold,
    quantityLostAfter: inventory.quantityLost,
    reason,
    createdBy,
  });

  return inventory;
}

export async function reserveForOrder(connection, {
  articleId,
  quantity,
  orderId,
  userId = null,
  reason = 'Reserva por orden',
}) {
  const quantityToReserve = normalizePositiveQuantity(quantity, 'La cantidad a reservar');
  const before = await getInventoryByArticleIdForUpdate(connection, articleId);

  if (before.quantityAvailable < quantityToReserve) {
    throw badRequest(`No hay stock suficiente para la prenda ${articleId}.`);
  }

  const after = assertInventoryBalance({
    ...before,
    quantityAvailable: before.quantityAvailable - quantityToReserve,
    quantityReserved: before.quantityReserved + quantityToReserve,
    updatedBy: userId || null,
  });

  await updateInventory(connection, after);
  await recordInventoryMovement(connection, buildMovementFromTransition({
    articleId,
    before,
    after,
    movementType: INVENTORY_MOVEMENT_TYPES.RESERVE,
    orderId,
    reason,
    userId,
  }));

  return { before, after };
}

export async function releaseReservation(connection, {
  articleId,
  quantity,
  orderId,
  userId = null,
  reason = 'Liberacion de reserva',
}) {
  const quantityToRelease = normalizePositiveQuantity(quantity, 'La cantidad a liberar');
  const before = await getInventoryByArticleIdForUpdate(connection, articleId);

  if (before.quantityReserved < quantityToRelease) {
    throw badRequest(`No hay stock reservado suficiente para liberar la prenda ${articleId}.`);
  }

  const after = assertInventoryBalance({
    ...before,
    quantityAvailable: before.quantityAvailable + quantityToRelease,
    quantityReserved: before.quantityReserved - quantityToRelease,
    updatedBy: userId || null,
  });

  await updateInventory(connection, after);
  await recordInventoryMovement(connection, buildMovementFromTransition({
    articleId,
    before,
    after,
    movementType: INVENTORY_MOVEMENT_TYPES.RELEASE_RESERVATION,
    orderId,
    reason,
    userId,
  }));

  return { before, after, releasedQuantity: quantityToRelease };
}

export async function confirmSale(connection, {
  articleId,
  quantity,
  orderId,
  userId = null,
  reason = 'Venta aprobada',
}) {
  const quantityToSell = normalizePositiveQuantity(quantity, 'La cantidad a vender');
  const before = await getInventoryByArticleIdForUpdate(connection, articleId);

  if (before.quantityReserved < quantityToSell) {
    throw badRequest(`No hay stock reservado suficiente para vender la prenda ${articleId}.`);
  }

  const after = assertInventoryBalance({
    ...before,
    quantityReserved: before.quantityReserved - quantityToSell,
    quantitySold: before.quantitySold + quantityToSell,
    updatedBy: userId || null,
  });

  await updateInventory(connection, after);
  await recordInventoryMovement(connection, buildMovementFromTransition({
    articleId,
    before,
    after,
    movementType: INVENTORY_MOVEMENT_TYPES.SALE,
    orderId,
    reason,
    userId,
  }));

  return { before, after };
}

export async function adjustInventory(connection, {
  articleId,
  quantityTotal = null,
  quantityAvailable = null,
  quantityReserved = null,
  quantitySold = null,
  quantityLost = null,
  userId = null,
  reason = 'Ajuste manual de inventario',
}) {
  const before = await getInventoryByArticleIdForUpdate(connection, articleId);
  const nextReserved = quantityReserved == null
    ? before.quantityReserved
    : normalizeIntegerQuantity(quantityReserved, 'El stock reservado');
  const nextSold = quantitySold == null
    ? before.quantitySold
    : normalizeIntegerQuantity(quantitySold, 'El stock vendido');
  const nextAvailable = quantityAvailable == null
    ? before.quantityAvailable
    : normalizeIntegerQuantity(quantityAvailable, 'El stock disponible');

  let nextTotal = quantityTotal == null
    ? before.quantityTotal
    : normalizeIntegerQuantity(quantityTotal, 'El stock total');
  let nextLost = quantityLost == null
    ? nextTotal - nextAvailable - nextReserved - nextSold
    : normalizeIntegerQuantity(quantityLost, 'El stock perdido');

  if (nextLost < 0 && quantityTotal == null && quantityLost == null) {
    nextTotal = nextAvailable + nextReserved + nextSold;
    nextLost = 0;
  }

  const after = assertInventoryBalance({
    articleId: before.articleId,
    quantityTotal: nextTotal,
    quantityAvailable: nextAvailable,
    quantityReserved: nextReserved,
    quantitySold: nextSold,
    quantityLost: nextLost,
    updatedBy: userId || null,
  });

  await updateInventory(connection, after);

  const movement = buildMovementFromTransition({
    articleId,
    before,
    after,
    movementType: INVENTORY_MOVEMENT_TYPES.MANUAL_ADJUSTMENT,
    reason,
    userId,
  });

  if (
    movement.availableDelta !== 0 ||
    movement.reservedDelta !== 0 ||
    movement.soldDelta !== 0 ||
    movement.lostDelta !== 0
  ) {
    await recordInventoryMovement(connection, movement);
  }

  return { before, after };
}

export const inventoryTestInternals = {
  assertInventoryBalance,
  normalizeIntegerQuantity,
};
