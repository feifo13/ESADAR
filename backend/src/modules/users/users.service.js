import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { badRequest, notFound } from '../../utils/app-error.js';
import { buildLikeValue, resolveSortClause } from '../../utils/listing.js';
import { buildSqlLimitOffsetClause, buildSqlPlaceholders, normalizeSqlLimit, normalizeSqlOffset } from '../../utils/sql-safety.js';
import { logAudit } from '../audit/audit.service.js';
import { hashPassword } from '../../utils/password.js';

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
    address: row.address,
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
        u.address,
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
  const safePageSize = normalizeSqlLimit(pageSize, 25, 100);
  const safeOffset = normalizeSqlOffset(offset);
  const limitOffsetClause = buildSqlLimitOffsetClause(safePageSize, safeOffset, 25, 100);
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
      OR u.address LIKE ?
      OR EXISTS (
        SELECT 1
        FROM user_roles search_ur
        INNER JOIN roles search_r ON search_r.id = search_ur.role_id
        WHERE search_ur.user_id = u.id
          AND search_r.code LIKE ?
      )
    )`);
    params.push(like, like, like, like, like, like, like);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const orderBy = resolveSortClause({
    sortBy,
    sortDir,
    sortMap: USER_SORTS,
    fallbackKey: 'createdAt',
  });

  const [rows] = await pool.execute(
    `
      SELECT
        u.id,
        u.first_name AS firstName,
        u.last_name AS lastName,
        u.email,
        u.phone,
        u.instagram,
        u.address,
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
      ${limitOffsetClause}
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



export async function getUserByIdForAdmin(userId) {
  const user = await getUserForAdmin(userId);
  if (!user) throw notFound('Usuario no encontrado.');
  return user;
}

async function getAdminRoleUserCount(connection) {
  const [rows] = await connection.execute(
    `
      SELECT COUNT(DISTINCT ur.user_id) AS total
      FROM user_roles ur
      INNER JOIN roles r ON r.id = ur.role_id
      INNER JOIN users u ON u.id = ur.user_id
      WHERE r.code IN ('SUPER_ADMIN','ADMIN')
        AND u.is_active = 1
    `,
  );
  return Number(rows[0]?.total || 0);
}

async function resolveRoleIds(connection, roleCodes) {
  const normalizedCodes = [...new Set((roleCodes || []).map((role) => String(role).trim()).filter(Boolean))];
  if (!normalizedCodes.length) throw badRequest('El usuario debe tener al menos un rol.');
  const placeholders = buildSqlPlaceholders(normalizedCodes);
  const [rows] = await connection.execute(
    `SELECT id, code FROM roles WHERE code IN (${placeholders}) AND is_active = 1`,
    normalizedCodes,
  );
  const foundCodes = rows.map((row) => row.code);
  const missing = normalizedCodes.filter((code) => !foundCodes.includes(code));
  if (missing.length) {
    throw badRequest(`Roles no válidos: ${missing.join(', ')}`);
  }
  return rows.map((row) => ({ id: Number(row.id), code: row.code }));
}

export async function updateUserForAdmin(userId, input, auditContext) {
  return withTransaction(async (connection) => {
    const before = await getUserForAdmin(userId, connection, { forUpdate: true });
    if (!before) throw notFound('Usuario no encontrado.');

    const nextRoles = [...new Set(input.roles || [])];
    const nextHasAdminRole = nextRoles.some((role) => ['SUPER_ADMIN', 'ADMIN'].includes(role));
    const beforeHasAdminRole = before.roles.some((role) => ['SUPER_ADMIN', 'ADMIN'].includes(role));

    if (Number(userId) === Number(auditContext.actorUserId)) {
      if (!input.isActive) {
        throw badRequest('No puedes desactivar tu propio usuario desde esta vista.');
      }
      if (beforeHasAdminRole && !nextHasAdminRole) {
        throw badRequest('No puedes quitarte tu propio rol de administración desde esta vista.');
      }
    }

    if (beforeHasAdminRole && !nextHasAdminRole) {
      const adminCount = await getAdminRoleUserCount(connection);
      if (adminCount <= 1) {
        throw badRequest('No puedes quitar el último usuario administrador activo.');
      }
    }

    if (input.email) {
      const [emailRows] = await connection.execute(
        'SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1',
        [input.email, userId],
      );
      if (emailRows.length) {
        throw badRequest('Ya existe otro usuario con ese email.');
      }
    }

    await connection.execute(
      `
        UPDATE users
        SET
          first_name = ?,
          last_name = ?,
          email = ?,
          phone = ?,
          instagram = ?,
          address = ?,
          is_active = ?,
          updated_by = ?
        WHERE id = ?
      `,
      [
        input.firstName,
        input.lastName,
        input.email,
        input.phone,
        input.instagram,
        input.address,
        input.isActive ? 1 : 0,
        auditContext.actorUserId || null,
        userId,
      ],
    );

    const roles = await resolveRoleIds(connection, nextRoles);
    await connection.execute('DELETE FROM user_roles WHERE user_id = ?', [userId]);
    for (const role of roles) {
      await connection.execute(
        'INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES (?, ?, ?)',
        [userId, role.id, auditContext.actorUserId || null],
      );
    }

    const after = await getUserForAdmin(userId, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'USER_UPDATED',
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


export async function updateUserPasswordForAdmin(userId, input, auditContext) {
  return withTransaction(async (connection) => {
    const before = await getUserForAdmin(userId, connection, { forUpdate: true });
    if (!before) throw notFound('Usuario no encontrado.');

    const passwordHash = await hashPassword(input.password);

    await connection.execute(
      `
        UPDATE users
        SET
          password_hash = ?,
          updated_by = ?
        WHERE id = ?
      `,
      [passwordHash, auditContext.actorUserId || null, userId],
    );

    await connection.execute(
      `
        UPDATE password_reset_tokens
        SET used_at = COALESCE(used_at, NOW())
        WHERE user_id = ?
          AND used_at IS NULL
      `,
      [userId],
    );

    const after = await getUserForAdmin(userId, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'USER_PASSWORD_CHANGED_BY_ADMIN',
        entityType: 'users',
        entityId: userId,
        beforeJson: { id: before.id, email: before.email, roles: before.roles },
        afterJson: { id: after.id, email: after.email, roles: after.roles },
        metadataJson: { mode: 'super-admin-reset' },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return after;
  });
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
