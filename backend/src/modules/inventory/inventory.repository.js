import { notFound } from '../../utils/app-error.js';

export function normalizeInventoryRow(row) {
  if (!row) return null;

  return {
    articleId: Number(row.articleId),
    quantityTotal: Number(row.quantityTotal || 0),
    quantityAvailable: Number(row.quantityAvailable || 0),
    quantityReserved: Number(row.quantityReserved || 0),
    quantitySold: Number(row.quantitySold || 0),
    quantityLost: Number(row.quantityLost || 0),
    updatedAt: row.updatedAt || null,
    updatedBy: row.updatedBy != null ? Number(row.updatedBy) : null,
  };
}

export async function findInventoryByArticleId(connection, articleId, options = {}) {
  const lockClause = options.forUpdate ? 'FOR UPDATE' : '';
  const [rows] = await connection.execute(
    `
      SELECT
        article_id AS articleId,
        quantity_total AS quantityTotal,
        quantity_available AS quantityAvailable,
        quantity_reserved AS quantityReserved,
        quantity_sold AS quantitySold,
        quantity_lost AS quantityLost,
        updated_at AS updatedAt,
        updated_by AS updatedBy
      FROM article_inventory
      WHERE article_id = ?
      LIMIT 1
      ${lockClause}
    `,
    [articleId],
  );

  return normalizeInventoryRow(rows[0] || null);
}

export async function getInventoryByArticleIdForUpdate(connection, articleId) {
  const inventory = await findInventoryByArticleId(connection, articleId, { forUpdate: true });
  if (!inventory) {
    throw notFound('Inventario de articulo no encontrado.');
  }
  return inventory;
}

export async function insertInventory(connection, inventory) {
  await connection.execute(
    `
      INSERT INTO article_inventory (
        article_id,
        quantity_total,
        quantity_available,
        quantity_reserved,
        quantity_sold,
        quantity_lost,
        updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      inventory.articleId,
      inventory.quantityTotal,
      inventory.quantityAvailable,
      inventory.quantityReserved,
      inventory.quantitySold,
      inventory.quantityLost,
      inventory.updatedBy || null,
    ],
  );
}

export async function updateInventory(connection, inventory) {
  await connection.execute(
    `
      UPDATE article_inventory
      SET
        quantity_total = ?,
        quantity_available = ?,
        quantity_reserved = ?,
        quantity_sold = ?,
        quantity_lost = ?,
        updated_by = ?
      WHERE article_id = ?
    `,
    [
      inventory.quantityTotal,
      inventory.quantityAvailable,
      inventory.quantityReserved,
      inventory.quantitySold,
      inventory.quantityLost,
      inventory.updatedBy || null,
      inventory.articleId,
    ],
  );
}

export async function insertInventoryMovement(connection, movement) {
  await connection.execute(
    `
      INSERT INTO article_inventory_movements (
        article_id,
        order_id,
        movement_type,
        available_delta,
        reserved_delta,
        sold_delta,
        lost_delta,
        quantity_available_after,
        quantity_reserved_after,
        quantity_sold_after,
        quantity_lost_after,
        reason,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      movement.articleId,
      movement.orderId || null,
      movement.movementType,
      movement.availableDelta || 0,
      movement.reservedDelta || 0,
      movement.soldDelta || 0,
      movement.lostDelta || 0,
      movement.quantityAvailableAfter,
      movement.quantityReservedAfter,
      movement.quantitySoldAfter,
      movement.quantityLostAfter,
      movement.reason || null,
      movement.createdBy || null,
    ],
  );
}
