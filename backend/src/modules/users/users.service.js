import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { badRequest, notFound } from '../../utils/app-error.js';
import { buildLikeValue, resolveSortClause } from '../../utils/listing.js';
import { logAudit } from '../audit/audit.service.js';

const USER_SORTS = {
  createdAt: (direction) => `u.created_at ${direction}, u.id ${direction}`,
  updatedAt: (direction) => `u.updated_at ${direction}, u.id ${direction}`,
  lastLoginAt: (direction) => `u.last_login_at ${direction}, u.id ${direction}`,
  name: (direction) => `u.last_name ${direction}, u.first_name ${direction}, u.id DESC`,
  email: (direction) => `u.email ${direction}, u.id DESC`,
  status: (direction) => `u.is_active ${direction}, u.id DESC`,
};

function normalizeUserRow(row) {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    instagram: row.instagram,
    isActive: Boolean(row.isActive),
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    roles: row.roleCodes ? String(row.roleCodes).split(',').filter(Boolean) : [],
    orderCount: Number(row.orderCount || 0),
    offerCount: Number(row.offerCount || 0),
  };
}

async function getUserForAdmin(userId, connection = pool, options = {}) {
  const lockClause = options.forUpdate ? 'FOR UPDATE' : '';
  const [rows] = await connection.execute(
    `
      SELECT
        u.id,
        u.first_name AS firstName,
        u.last_name AS lastName,
        u.email,
        u.phone,
        u.instagram,
        u.is_active AS isActive,
        u.last_login_at AS lastLoginAt,
        u.created_at AS createdAt,
        u.updated_at AS updatedAt,
        (
          SELECT GROUP_CONCAT(r.code ORDER BY r.code SEPARATOR ',')
          FROM user_roles ur
          INNER JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = u.id
        ) AS roleCodes,
        (
          SELECT COUNT(*)
          FROM orders o
          WHERE o.user_id = u.id
        ) AS orderCount,
        (
          SELECT COUNT(*)
          FROM offers off
          INNER JOIN customers c ON c.id = off.customer_id
          WHERE c.user_id = u.id
        ) AS offerCount
      FROM users u
      WHERE u.id = ?
      LIMIT 1
      ${lockClause}
    `,
    [userId],
  );

  if (!rows.length) return null;
  return normalizeUserRow(rows[0]);
}

export async function listUsers({ filters, pagination }) {
  const { q, isActive, role, sortBy, sortDir } = filters;
  const { page, pageSize, offset } = pagination;
  const clauses = [];
  const params = [];

  if (typeof isActive === 'boolean') {
    clauses.push('u.is_active = ?');
    params.push(isActive ? 1 : 0);
  }

  if (role) {
    clauses.push(`EXISTS (
      SELECT 1
      FROM user_roles role_filter_ur
      INNER JOIN roles role_filter_r ON role_filter_r.id = role_filter_ur.role_id
      WHERE role_filter_ur.user_id = u.id
        AND role_filter_r.code = ?
    )`);
    params.push(role);
  }

  if (q) {
    const like = buildLikeValue(q);
    clauses.push(`(
      u.first_name LIKE ?
      OR u.last_name LIKE ?
      OR u.email LIKE ?
      OR u.phone LIKE ?
      OR u.instagram LIKE ?
      OR EXISTS (
        SELECT 1
        FROM user_roles search_ur
        INNER JOIN roles search_r ON search_r.id = search_ur.role_id
        WHERE search_ur.user_id = u.id
          AND search_r.code LIKE ?
      )
    )`);
    params.push(like, like, like, like, like, like);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const orderBy = resolveSortClause({
    sortBy,
    sortDir,
    sortMap: USER_SORTS,
    fallbackKey: 'createdAt',
  });

  const [rows] = await pool.query(
    `
      SELECT
        u.id,
        u.first_name AS firstName,
        u.last_name AS lastName,
        u.email,
        u.phone,
        u.instagram,
        u.is_active AS isActive,
        u.last_login_at AS lastLoginAt,
        u.created_at AS createdAt,
        u.updated_at AS updatedAt,
        GROUP_CONCAT(DISTINCT r.code ORDER BY r.code SEPARATOR ',') AS roleCodes,
        COUNT(DISTINCT o.id) AS orderCount,
        COUNT(DISTINCT off.id) AS offerCount
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      LEFT JOIN orders o ON o.user_id = u.id
      LEFT JOIN customers c ON c.user_id = u.id
      LEFT JOIN offers off ON off.customer_id = c.id
      ${where}
      GROUP BY u.id
      ORDER BY ${orderBy}
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    params,
  );

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM users u ${where}`,
    params,
  );

  return {
    items: rows.map(normalizeUserRow),
    pagination: {
      page,
      pageSize,
      total: countRows[0].total,
    },
  };
}

export async function setUserActiveStatus(userId, isActive, auditContext) {
  if (Number(userId) === Number(auditContext.actorUserId)) {
    throw badRequest('No puedes cambiar el estado de tu propio usuario desde esta vista.');
  }

  return withTransaction(async (connection) => {
    const before = await getUserForAdmin(userId, connection, { forUpdate: true });
    if (!before) throw notFound('Usuario no encontrado.');

    const [updateResult] = await connection.execute(
      `
        UPDATE users
        SET is_active = ?, updated_by = ?
        WHERE id = ? AND is_active <> ?
      `,
      [isActive ? 1 : 0, auditContext.actorUserId || null, userId, isActive ? 1 : 0],
    );

    const after = updateResult.affectedRows
      ? await getUserForAdmin(userId, connection)
      : before;

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        entityType: 'users',
        entityId: userId,
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

export async function deleteUser(userId, auditContext) {
  if (Number(userId) === Number(auditContext.actorUserId)) {
    throw badRequest('No puedes eliminar tu propio usuario desde esta vista.');
  }

  return withTransaction(async (connection) => {
    const before = await getUserForAdmin(userId, connection, { forUpdate: true });
    if (!before) throw notFound('Usuario no encontrado.');

    await connection.execute('DELETE FROM user_roles WHERE user_id = ?', [userId]);
    await connection.execute('DELETE FROM password_reset_tokens WHERE user_id = ?', [userId]);

    try {
      const [deleteResult] = await connection.execute('DELETE FROM users WHERE id = ?', [userId]);
      if (!deleteResult.affectedRows) throw notFound('Usuario no encontrado.');
    } catch (error) {
      if (error?.code === 'ER_ROW_IS_REFERENCED_2' || error?.errno === 1451) {
        throw badRequest('No se puede eliminar este usuario porque tiene registros vinculados. Puedes desactivarlo para bloquear el acceso.');
      }
      throw error;
    }

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'USER_DELETED',
        entityType: 'users',
        entityId: userId,
        beforeJson: before,
        metadataJson: {
          mode: 'admin-hard-delete',
        },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return { deleted: true, user: before };
  });
}
