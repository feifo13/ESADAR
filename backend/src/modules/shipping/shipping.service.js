import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { badRequest, notFound } from '../../utils/app-error.js';
import { buildLikeValue, resolveSortClause } from '../../utils/listing.js';
import { buildSqlLimitOffsetClause, normalizeSqlLimit, normalizeSqlOffset } from '../../utils/sql-safety.js';
import { logAudit } from '../audit/audit.service.js';

const SHIPPING_SORTS = {
  createdAt: (direction) => `sm.created_at ${direction}, sm.id ${direction}`,
  updatedAt: (direction) => `sm.updated_at ${direction}, sm.id ${direction}`,
  description: (direction) => `sm.description ${direction}, sm.id DESC`,
  baseCost: (direction) => `sm.base_cost ${direction}, sm.id DESC`,
  status: (direction) => `sm.is_active ${direction}, sm.id DESC`,
};

function normalizeShippingRow(row) {
  return {
    id: row.id,
    description: row.description,
    baseCost: Number(row.baseCost || 0),
    instructions: row.instructions || '',
    isActive: Boolean(row.isActive),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    orderCount: Number(row.orderCount || 0),
  };
}

async function getShippingMethodForAdmin(id, connection = pool, options = {}) {
  const lockClause = options.forUpdate ? 'FOR UPDATE' : '';
  const [rows] = await connection.execute(
    `
      SELECT
        sm.id,
        sm.description,
        sm.base_cost AS baseCost,
        sm.instructions,
        sm.is_active AS isActive,
        sm.created_at AS createdAt,
        sm.updated_at AS updatedAt,
        (
          SELECT COUNT(*)
          FROM orders o
          WHERE o.shipping_method_id = sm.id
        ) AS orderCount
      FROM shipping_methods sm
      WHERE sm.id = ?
      LIMIT 1
      ${lockClause}
    `,
    [id],
  );

  if (!rows.length) return null;
  return normalizeShippingRow(rows[0]);
}

export async function listShippingMethodsForAdmin({ filters, pagination }) {
  const { q, isActive, sortBy, sortDir } = filters;
  const { page, pageSize, offset } = pagination;
  const safePageSize = normalizeSqlLimit(pageSize, 25, 100);
  const safeOffset = normalizeSqlOffset(offset);
  const limitOffsetClause = buildSqlLimitOffsetClause(safePageSize, safeOffset, 25, 100);
  const clauses = [];
  const params = [];

  if (typeof isActive === 'boolean') {
    clauses.push('sm.is_active = ?');
    params.push(isActive ? 1 : 0);
  }

  if (q) {
    const like = buildLikeValue(q);
    clauses.push('(sm.description LIKE ? OR sm.instructions LIKE ?)');
    params.push(like, like);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const orderBy = resolveSortClause({
    sortBy,
    sortDir,
    sortMap: SHIPPING_SORTS,
    fallbackKey: 'createdAt',
  });

  const [rows] = await pool.execute(
    `
      SELECT
        sm.id,
        sm.description,
        sm.base_cost AS baseCost,
        sm.instructions,
        sm.is_active AS isActive,
        sm.created_at AS createdAt,
        sm.updated_at AS updatedAt,
        COUNT(DISTINCT o.id) AS orderCount
      FROM shipping_methods sm
      LEFT JOIN orders o ON o.shipping_method_id = sm.id
      ${where}
      GROUP BY sm.id
      ORDER BY ${orderBy}
      ${limitOffsetClause}
    `,
    params,
  );

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM shipping_methods sm ${where}`,
    params,
  );

  return {
    items: rows.map(normalizeShippingRow),
    pagination: {
      page,
      pageSize,
      total: countRows[0].total,
    },
  };
}

export async function getShippingMethodDetail(id) {
  const method = await getShippingMethodForAdmin(id);
  if (!method) throw notFound('Metodo de envio no encontrado.');
  return method;
}

export async function createShippingMethod(input, auditContext) {
  return withTransaction(async (connection) => {
    const [insertResult] = await connection.execute(
      `
        INSERT INTO shipping_methods (
          description,
          base_cost,
          instructions,
          is_active,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        input.description,
        input.baseCost,
        input.instructions || null,
        input.isActive ? 1 : 0,
        auditContext.actorUserId || null,
        auditContext.actorUserId || null,
      ],
    );

    const method = await getShippingMethodForAdmin(insertResult.insertId, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'SHIPPING_METHOD_CREATED',
        entityType: 'shipping_methods',
        entityId: insertResult.insertId,
        afterJson: method,
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return method;
  });
}

export async function updateShippingMethod(id, input, auditContext) {
  return withTransaction(async (connection) => {
    const before = await getShippingMethodForAdmin(id, connection, { forUpdate: true });
    if (!before) throw notFound('Metodo de envio no encontrado.');

    await connection.execute(
      `
        UPDATE shipping_methods
        SET
          description = ?,
          base_cost = ?,
          instructions = ?,
          is_active = ?,
          updated_by = ?
        WHERE id = ?
      `,
      [
        input.description,
        input.baseCost,
        input.instructions || null,
        input.isActive ? 1 : 0,
        auditContext.actorUserId || null,
        id,
      ],
    );

    const after = await getShippingMethodForAdmin(id, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'SHIPPING_METHOD_UPDATED',
        entityType: 'shipping_methods',
        entityId: id,
        beforeJson: before,
        afterJson: after,
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return after;
  });
}

export async function setShippingMethodActiveStatus(id, isActive, auditContext) {
  return withTransaction(async (connection) => {
    const before = await getShippingMethodForAdmin(id, connection, { forUpdate: true });
    if (!before) throw notFound('Metodo de envio no encontrado.');

    const [result] = await connection.execute(
      `
        UPDATE shipping_methods
        SET is_active = ?, updated_by = ?
        WHERE id = ? AND is_active <> ?
      `,
      [isActive ? 1 : 0, auditContext.actorUserId || null, id, isActive ? 1 : 0],
    );

    const after = result.affectedRows ? await getShippingMethodForAdmin(id, connection) : before;

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: isActive ? 'SHIPPING_METHOD_ACTIVATED' : 'SHIPPING_METHOD_DEACTIVATED',
        entityType: 'shipping_methods',
        entityId: id,
        beforeJson: before,
        afterJson: after,
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return after;
  });
}

export async function deleteShippingMethod(id, auditContext) {
  return withTransaction(async (connection) => {
    const before = await getShippingMethodForAdmin(id, connection, { forUpdate: true });
    if (!before) throw notFound('Metodo de envio no encontrado.');

    try {
      const [deleteResult] = await connection.execute('DELETE FROM shipping_methods WHERE id = ?', [id]);
      if (!deleteResult.affectedRows) throw notFound('Metodo de envio no encontrado.');
    } catch (error) {
      if (error?.code === 'ER_ROW_IS_REFERENCED_2' || error?.errno === 1451) {
        throw badRequest('No se puede eliminar este metodo porque ya tiene ordenes vinculadas. Puedes desactivarlo.');
      }
      throw error;
    }

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'SHIPPING_METHOD_DELETED',
        entityType: 'shipping_methods',
        entityId: id,
        beforeJson: before,
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return { deleted: true, method: before };
  });
}
