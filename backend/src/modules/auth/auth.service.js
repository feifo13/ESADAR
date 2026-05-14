import crypto from 'node:crypto';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { comparePassword, hashPassword } from '../../utils/password.js';
import { signAccessToken } from '../../utils/jwt.js';
import { badRequest, notFound, unauthorized } from '../../utils/app-error.js';
import { logAudit } from '../audit/audit.service.js';
import { assertPasswordResetMailerReady, sendPasswordResetEmail, sendWelcomeUserEmail } from './auth.mailer.js';
import { env } from '../../config/env.js';

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


function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function buildResetUrl(token, publicSiteUrl) {
  const base = (publicSiteUrl || env.publicSiteUrl || env.appOrigin || 'http://localhost:5173').replace(/\/$/, '');
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

async function ensureCustomerRole(connection) {
  await connection.execute(
    `
      INSERT INTO roles (code, name, is_active)
      VALUES ('CUSTOMER', 'Customer', 1)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        is_active = 1
    `,
  );

  const [roleRows] = await connection.execute(
    'SELECT id FROM roles WHERE code = ? AND is_active = 1 LIMIT 1',
    ['CUSTOMER'],
  );

  if (!roleRows.length) {
    throw notFound('Role CUSTOMER was not found in roles table');
  }

  return roleRows[0].id;
}

export async function registerUser(input, auditContext) {
  const existing = await getUserByEmail(input.email);
  if (existing) {
    throw badRequest('A user with that email already exists');
  }

  const result = await withTransaction(async (connection) => {
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

    const customerRoleId = await ensureCustomerRole(connection);

    await connection.execute(
      'INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES (?, ?, ?)',
      [userId, customerRoleId, auditContext.actorUserId || null],
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

  sendWelcomeUserEmail({
    user: result.user,
    publicSiteUrl: auditContext.publicSiteUrl,
  }).catch((error) => {
    console.warn('[auth] welcome email failed', error?.message || error);
  });

  return result;
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



export async function requestPasswordReset(input, auditContext) {
  // Fail the same way for any email when SMTP is missing, avoiding user enumeration.
  assertPasswordResetMailerReady();

  const user = await getUserByEmail(input.email);
  if (!user || !user.isActive) {
    return { sent: false };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(token);
  const resetUrl = buildResetUrl(token, auditContext.publicSiteUrl);

  await withTransaction(async (connection) => {
    await connection.execute(
      `
        INSERT INTO password_reset_tokens (
          user_id,
          token_hash,
          expires_at,
          requested_ip,
          requested_user_agent
        ) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR), ?, ?)
      `,
      [
        user.id,
        tokenHash,
        auditContext.ipAddress || null,
        auditContext.userAgent || null,
      ],
    );

    await logAudit(
      {
        actorUserId: user.id,
        actorLabel: user.email,
        actionCode: 'PASSWORD_RESET_REQUESTED',
        entityType: 'users',
        entityId: user.id,
        metadataJson: { email: user.email },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );
  });

  await sendPasswordResetEmail({
    toEmail: user.email,
    toName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    resetUrl,
    publicSiteUrl: auditContext.publicSiteUrl,
  });

  return { sent: true };
}

export async function resetUserPassword(input, auditContext) {
  const tokenHash = hashResetToken(input.token);
  const passwordHash = await hashPassword(input.password);

  return withTransaction(async (connection) => {
    const [rows] = await connection.execute(
      `
        SELECT
          prt.id,
          prt.user_id AS userId,
          u.email,
          u.first_name AS firstName,
          u.last_name AS lastName,
          u.is_active AS isActive
        FROM password_reset_tokens prt
        INNER JOIN users u ON u.id = prt.user_id
        WHERE prt.token_hash = ?
          AND prt.used_at IS NULL
          AND prt.expires_at > NOW()
        LIMIT 1
      `,
      [tokenHash],
    );

    if (!rows.length || !rows[0].isActive) {
      throw badRequest('El link de recuperacion no es valido o ya vencio.');
    }

    const row = rows[0];

    await connection.execute(
      `
        UPDATE users
        SET
          password_hash = ?,
          updated_by = ?
        WHERE id = ?
      `,
      [passwordHash, row.userId, row.userId],
    );

    await connection.execute(
      `
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE id = ?
      `,
      [row.id],
    );

    await connection.execute(
      `
        UPDATE password_reset_tokens
        SET used_at = COALESCE(used_at, NOW())
        WHERE user_id = ?
          AND id <> ?
          AND used_at IS NULL
      `,
      [row.userId, row.id],
    );

    await logAudit(
      {
        actorUserId: row.userId,
        actorLabel: row.email,
        actionCode: 'PASSWORD_RESET_COMPLETED',
        entityType: 'users',
        entityId: row.userId,
        metadataJson: { mode: 'forgot-password' },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return { ok: true };
  });
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
