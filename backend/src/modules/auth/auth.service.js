import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { comparePassword, hashPassword } from '../../utils/password.js';
import { signAccessToken } from '../../utils/jwt.js';
import { badRequest, notFound, unauthorized } from '../../utils/app-error.js';
import { logAudit } from '../audit/audit.service.js';

async function getUserByEmail(email, connection = pool) {
  const [rows] = await connection.execute(
    `
      SELECT
        u.id,
        u.first_name AS firstName,
        u.last_name AS lastName,
        u.birth_date AS birthDate,
        u.email,
        u.password_hash AS passwordHash,
        u.address,
        u.phone,
        u.instagram,
        u.is_active AS isActive,
        u.last_login_at AS lastLoginAt,
        GROUP_CONCAT(r.code ORDER BY r.code SEPARATOR ',') AS roleCodes
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.email = ?
      GROUP BY u.id
      LIMIT 1
    `,
    [email],
  );

  if (!rows.length) return null;

  return normalizeUserRow(rows[0]);
}

async function getUserById(userId, connection = pool) {
  const [rows] = await connection.execute(
    `
      SELECT
        u.id,
        u.first_name AS firstName,
        u.last_name AS lastName,
        u.birth_date AS birthDate,
        u.email,
        u.password_hash AS passwordHash,
        u.address,
        u.phone,
        u.instagram,
        u.is_active AS isActive,
        u.last_login_at AS lastLoginAt,
        GROUP_CONCAT(r.code ORDER BY r.code SEPARATOR ',') AS roleCodes
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.id = ?
      GROUP BY u.id
      LIMIT 1
    `,
    [userId],
  );

  if (!rows.length) return null;

  return normalizeUserRow(rows[0]);
}

function normalizeUserRow(row) {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    birthDate: row.birthDate,
    email: row.email,
    passwordHash: row.passwordHash,
    address: row.address,
    phone: row.phone,
    instagram: row.instagram,
    isActive: Boolean(row.isActive),
    lastLoginAt: row.lastLoginAt,
    roles: row.roleCodes ? String(row.roleCodes).split(',') : [],
  };
}

function toAuthPayload(user) {
  return {
    sub: String(user.id),
    userId: user.id,
    email: user.email,
    name: `${user.firstName} ${user.lastName}`.trim(),
    roles: user.roles,
  };
}

export async function registerUser(input, auditContext) {
  const existing = await getUserByEmail(input.email);
  if (existing) {
    throw badRequest('A user with that email already exists');
  }

  return withTransaction(async (connection) => {
    const passwordHash = await hashPassword(input.password);

    const [userInsert] = await connection.execute(
      `
        INSERT INTO users (
          first_name,
          last_name,
          birth_date,
          email,
          password_hash,
          address,
          phone,
          instagram,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.firstName,
        input.lastName,
        input.birthDate || null,
        input.email,
        passwordHash,
        input.address || null,
        input.phone || null,
        input.instagram || null,
        auditContext.actorUserId || null,
        auditContext.actorUserId || null,
      ],
    );

    const userId = userInsert.insertId;

    const [roleRows] = await connection.execute(
      'SELECT id FROM roles WHERE code = ? LIMIT 1',
      ['CUSTOMER'],
    );

    if (!roleRows.length) {
      throw notFound('Role CUSTOMER was not found in roles table');
    }

    await connection.execute(
      'INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES (?, ?, ?)',
      [userId, roleRows[0].id, auditContext.actorUserId || null],
    );

    await connection.execute(
      `
        INSERT INTO customers (
          user_id,
          first_name,
          last_name,
          birth_date,
          email,
          address,
          phone,
          instagram,
          source,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'REGISTERED', ?, ?)
      `,
      [
        userId,
        input.firstName,
        input.lastName,
        input.birthDate || null,
        input.email,
        input.address || null,
        input.phone || null,
        input.instagram || null,
        auditContext.actorUserId || null,
        auditContext.actorUserId || null,
      ],
    );

    const user = await getUserById(userId, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId || userId,
        actorLabel: user.email,
        actionCode: 'USER_CREATED',
        entityType: 'users',
        entityId: userId,
        afterJson: {
          id: user.id,
          email: user.email,
          roles: user.roles,
        },
        metadataJson: {
          mode: 'self-register',
        },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    const token = signAccessToken(toAuthPayload(user));
    return { user: sanitizeUser(user), token };
  });
}

export async function loginUser(input, auditContext) {
  const user = await getUserByEmail(input.email);
  if (!user || !user.passwordHash) {
    throw unauthorized('Invalid credentials');
  }

  const matches = await comparePassword(input.password, user.passwordHash);
  if (!matches) {
    throw unauthorized('Invalid credentials');
  }

  if (!user.isActive) {
    throw unauthorized('User is inactive');
  }

  await pool.execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

  await logAudit({
    actorUserId: user.id,
    actorLabel: user.email,
    actionCode: 'USER_LOGIN',
    entityType: 'users',
    entityId: user.id,
    metadataJson: {
      roles: user.roles,
    },
    source: auditContext.source,
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
  });

  const token = signAccessToken(toAuthPayload(user));
  return { user: sanitizeUser(user), token };
}

export async function getCurrentUser(userId) {
  const user = await getUserById(userId);
  if (!user) {
    throw notFound('User not found');
  }
  return sanitizeUser(user);
}

function sanitizeUser(user) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    birthDate: user.birthDate,
    email: user.email,
    address: user.address,
    phone: user.phone,
    instagram: user.instagram,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    roles: user.roles,
  };
}
