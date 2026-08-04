import crypto from 'node:crypto';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { comparePassword, hashPassword } from '../../utils/password.js';
import { signAccessToken } from '../../utils/jwt.js';
import { badRequest, conflict, notFound, unauthorized } from '../../utils/app-error.js';
import { logAudit } from '../audit/audit.service.js';
import { assertPasswordResetMailerReady, sendPasswordResetEmail, sendWelcomeUserEmail } from './auth.mailer.js';
import { env } from '../../config/env.js';
import { sanitizePublicUrl } from '../../utils/assets.js';
import { verifyGoogleCredential } from './google-identity.js';
import { isGoogleCustomerEligible } from './google-auth-policy.js';

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


async function getUserByGoogleSubject(subject, connection = pool) {
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
      FROM user_auth_identities uai
      INNER JOIN users u ON u.id = uai.user_id
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE uai.provider = 'GOOGLE'
        AND uai.provider_subject = ?
      GROUP BY u.id
      LIMIT 1
    `,
    [subject],
  );

  if (!rows.length) return null;
  return normalizeUserRow(rows[0]);
}

async function getGoogleIdentityByUserId(userId, connection = pool) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        user_id AS userId,
        provider_subject AS providerSubject,
        provider_email AS providerEmail,
        email_verified AS emailVerified,
        last_login_at AS lastLoginAt
      FROM user_auth_identities
      WHERE user_id = ?
        AND provider = 'GOOGLE'
      LIMIT 1
    `,
    [userId],
  );

  return rows[0] || null;
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

function assertGoogleCustomerEligible(user) {
  if (!isGoogleCustomerEligible(user.roles)) {
    throw conflict('Esta cuenta debe ingresar con email y contraseña.', {
      code: 'GOOGLE_LOGIN_NOT_AVAILABLE',
    });
  }
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
  const base =
    sanitizePublicUrl(publicSiteUrl) ||
    sanitizePublicUrl(env.publicSiteUrl) ||
    sanitizePublicUrl(env.appOrigin) ||
    'http://localhost:5173';
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




async function completeGoogleLogin(user, googleIdentity, auditContext) {
  if (!user.isActive) {
    throw unauthorized('User is inactive');
  }
  assertGoogleCustomerEligible(user);

  return withTransaction(async (connection) => {
    const currentUser = await getUserById(user.id, connection);
    if (!currentUser || !currentUser.isActive) {
      throw unauthorized('User is inactive');
    }
    assertGoogleCustomerEligible(currentUser);

    await connection.execute(
      'UPDATE users SET last_login_at = NOW() WHERE id = ?',
      [currentUser.id],
    );
    const [identityUpdate] = await connection.execute(
      `
        UPDATE user_auth_identities
        SET
          provider_email = ?,
          email_verified = 1,
          last_login_at = NOW()
        WHERE user_id = ?
          AND provider = 'GOOGLE'
          AND provider_subject = ?
      `,
      [googleIdentity.email, currentUser.id, googleIdentity.subject],
    );
    if (identityUpdate.affectedRows !== 1) {
      throw unauthorized('No se pudo validar la cuenta de Google.');
    }

    await logAudit(
      {
        actorUserId: currentUser.id,
        actorLabel: currentUser.email,
        actionCode: 'USER_LOGIN',
        entityType: 'users',
        entityId: currentUser.id,
        metadataJson: {
          roles: currentUser.roles,
          provider: 'GOOGLE',
        },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    const refreshedUser = await getUserById(currentUser.id, connection);
    const token = signAccessToken(toAuthPayload(refreshedUser));
    return { user: sanitizeUser(refreshedUser), token };
  });
}

async function createGoogleCustomer(googleIdentity, auditContext) {
  const result = await withTransaction(async (connection) => {
    const existingBySubject = await getUserByGoogleSubject(googleIdentity.subject, connection);
    if (existingBySubject) {
      return { alreadyLinkedUser: existingBySubject };
    }

    const existingByEmail = await getUserByEmail(googleIdentity.email, connection);
    if (existingByEmail) {
      assertGoogleCustomerEligible(existingByEmail);
      throw conflict('Ya existe una cuenta ESADAR con este email.', {
        code: 'GOOGLE_ACCOUNT_LINK_REQUIRED',
        email: googleIdentity.email,
      });
    }

    const [userInsert] = await connection.execute(
      `
        INSERT INTO users (
          first_name,
          last_name,
          email,
          password_hash,
          is_active,
          last_login_at,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, NULL, 1, NOW(), NULL, NULL)
      `,
      [googleIdentity.firstName, googleIdentity.lastName, googleIdentity.email],
    );

    const userId = userInsert.insertId;
    const customerRoleId = await ensureCustomerRole(connection);

    await connection.execute(
      'INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES (?, ?, NULL)',
      [userId, customerRoleId],
    );

    await connection.execute(
      `
        INSERT INTO customers (
          user_id,
          first_name,
          last_name,
          email,
          source,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, 'REGISTERED', NULL, NULL)
      `,
      [userId, googleIdentity.firstName, googleIdentity.lastName, googleIdentity.email],
    );

    const [identityInsert] = await connection.execute(
      `
        INSERT INTO user_auth_identities (
          user_id,
          provider,
          provider_subject,
          provider_email,
          email_verified,
          last_login_at
        ) VALUES (?, 'GOOGLE', ?, ?, 1, NOW())
      `,
      [userId, googleIdentity.subject, googleIdentity.email],
    );

    const user = await getUserById(userId, connection);

    await logAudit(
      {
        actorUserId: userId,
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
          mode: 'google-register',
          provider: 'GOOGLE',
        },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    await logAudit(
      {
        actorUserId: userId,
        actorLabel: user.email,
        actionCode: 'GOOGLE_IDENTITY_LINKED',
        entityType: 'user_auth_identities',
        entityId: identityInsert.insertId,
        metadataJson: {
          provider: 'GOOGLE',
          mode: 'google-register',
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

  if (result.alreadyLinkedUser) {
    return completeGoogleLogin(result.alreadyLinkedUser, googleIdentity, auditContext);
  }

  sendWelcomeUserEmail({
    user: result.user,
    publicSiteUrl: auditContext.publicSiteUrl,
  }).catch((error) => {
    console.warn('[auth] Google welcome email failed', error?.message || error);
  });

  return result;
}

export async function loginWithGoogle(input, auditContext) {
  const googleIdentity = await verifyGoogleCredential(input.credential);
  const linkedUser = await getUserByGoogleSubject(googleIdentity.subject);

  if (linkedUser) {
    return completeGoogleLogin(linkedUser, googleIdentity, auditContext);
  }

  const existingUser = await getUserByEmail(googleIdentity.email);
  if (existingUser) {
    if (!existingUser.isActive) {
      throw unauthorized('User is inactive');
    }
    assertGoogleCustomerEligible(existingUser);
    throw conflict('Ya existe una cuenta ESADAR con este email.', {
      code: 'GOOGLE_ACCOUNT_LINK_REQUIRED',
      email: googleIdentity.email,
    });
  }

  try {
    return await createGoogleCustomer(googleIdentity, auditContext);
  } catch (error) {
    if (error?.code !== 'ER_DUP_ENTRY') throw error;

    const raceLinkedUser = await getUserByGoogleSubject(googleIdentity.subject);
    if (raceLinkedUser) {
      return completeGoogleLogin(raceLinkedUser, googleIdentity, auditContext);
    }

    const raceExistingUser = await getUserByEmail(googleIdentity.email);
    if (raceExistingUser) {
      if (!raceExistingUser.isActive) {
        throw unauthorized('User is inactive');
      }
      assertGoogleCustomerEligible(raceExistingUser);
      throw conflict('Ya existe una cuenta ESADAR con este email.', {
        code: 'GOOGLE_ACCOUNT_LINK_REQUIRED',
        email: googleIdentity.email,
      });
    }

    throw error;
  }
}

export async function linkGoogleAccount(input, auditContext) {
  const googleIdentity = await verifyGoogleCredential(input.credential);
  const linkedUser = await getUserByGoogleSubject(googleIdentity.subject);

  if (linkedUser) {
    return completeGoogleLogin(linkedUser, googleIdentity, auditContext);
  }

  const user = await getUserByEmail(googleIdentity.email);
  if (!user || !user.isActive) {
    throw unauthorized('No se pudo vincular la cuenta de Google.');
  }

  assertGoogleCustomerEligible(user);

  if (!user.passwordHash) {
    throw conflict('Esta cuenta no admite vinculación mediante contraseña.', {
      code: 'GOOGLE_PASSWORD_LOGIN_UNAVAILABLE',
    });
  }

  const matches = await comparePassword(input.password, user.passwordHash);
  if (!matches) {
    throw unauthorized('Contraseña incorrecta.');
  }

  try {
    return await withTransaction(async (connection) => {
      const currentUser = await getUserById(user.id, connection);
      if (!currentUser || !currentUser.isActive) {
        throw unauthorized('No se pudo vincular la cuenta de Google.');
      }
      assertGoogleCustomerEligible(currentUser);
      if (currentUser.passwordHash !== user.passwordHash) {
        throw unauthorized('La contraseña cambió. Intenta nuevamente.');
      }

      const identityBySubject = await getUserByGoogleSubject(googleIdentity.subject, connection);
      if (identityBySubject && identityBySubject.id !== currentUser.id) {
        throw conflict('Esta cuenta de Google ya está vinculada a otro usuario.', {
          code: 'GOOGLE_ACCOUNT_ALREADY_LINKED',
        });
      }

      let identity = await getGoogleIdentityByUserId(currentUser.id, connection);
      let linkedNow = false;

      if (identity && identity.providerSubject !== googleIdentity.subject) {
        throw conflict('La cuenta ESADAR ya está vinculada a otra cuenta de Google.', {
          code: 'GOOGLE_ACCOUNT_ALREADY_LINKED',
        });
      }

      if (!identity) {
        const [identityInsert] = await connection.execute(
          `
            INSERT INTO user_auth_identities (
              user_id,
              provider,
              provider_subject,
              provider_email,
              email_verified,
              last_login_at
            ) VALUES (?, 'GOOGLE', ?, ?, 1, NOW())
          `,
          [currentUser.id, googleIdentity.subject, googleIdentity.email],
        );
        identity = { id: identityInsert.insertId };
        linkedNow = true;
      } else {
        await connection.execute(
          `
            UPDATE user_auth_identities
            SET
              provider_email = ?,
              email_verified = 1,
              last_login_at = NOW()
            WHERE id = ?
          `,
          [googleIdentity.email, identity.id],
        );
      }

      await connection.execute(
        'UPDATE users SET last_login_at = NOW() WHERE id = ?',
        [currentUser.id],
      );

      if (linkedNow) {
        await logAudit(
          {
            actorUserId: currentUser.id,
            actorLabel: currentUser.email,
            actionCode: 'GOOGLE_IDENTITY_LINKED',
            entityType: 'user_auth_identities',
            entityId: identity.id,
            metadataJson: {
              provider: 'GOOGLE',
              mode: 'password-confirmed-link',
            },
            source: auditContext.source,
            ipAddress: auditContext.ipAddress,
            userAgent: auditContext.userAgent,
          },
          connection,
        );
      }

      await logAudit(
        {
          actorUserId: currentUser.id,
          actorLabel: currentUser.email,
          actionCode: 'USER_LOGIN',
          entityType: 'users',
          entityId: currentUser.id,
          metadataJson: {
            roles: currentUser.roles,
            provider: 'GOOGLE',
            linkedNow,
          },
          source: auditContext.source,
          ipAddress: auditContext.ipAddress,
          userAgent: auditContext.userAgent,
        },
        connection,
      );

      const refreshedUser = await getUserById(currentUser.id, connection);
      const token = signAccessToken(toAuthPayload(refreshedUser));
      return { user: sanitizeUser(refreshedUser), token };
    });
  } catch (error) {
    if (error?.code !== 'ER_DUP_ENTRY') throw error;

    const raceLinkedUser = await getUserByGoogleSubject(googleIdentity.subject);
    if (raceLinkedUser?.id === user.id) {
      return completeGoogleLogin(raceLinkedUser, googleIdentity, auditContext);
    }

    throw conflict('Esta cuenta de Google ya está vinculada a otro usuario.', {
      code: 'GOOGLE_ACCOUNT_ALREADY_LINKED',
    });
  }
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
      throw badRequest('El link de recuperación no es válido o ya venció.');
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
