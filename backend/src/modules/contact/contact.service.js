import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { notFound } from '../../utils/app-error.js';
import { appendDateRangeFilters, buildLikeValue, resolveSortClause } from '../../utils/listing.js';
import { buildSqlLimitOffsetClause, normalizeSqlLimit, normalizeSqlOffset } from '../../utils/sql-safety.js';
import { logAudit } from '../audit/audit.service.js';
import { findPotentialCustomerByContact, upsertPotentialCustomerByContact } from '../customers/customer-helpers.js';
import { sendContactReplyEmail } from './contact.mailer.js';

const CONTACT_MESSAGE_SORTS = {
  createdAt: (direction) => `cm.created_at ${direction}, cm.id ${direction}`,
  status: (direction) => `cm.status ${direction}, cm.id DESC`,
  name: (direction) => `cm.last_name ${direction}, cm.first_name ${direction}, cm.id DESC`,
  email: (direction) => `cm.email ${direction}, cm.id DESC`,
};

export async function createContactMessage(input, auditContext) {
  return withTransaction(async (connection) => {
    const existingLead = await findPotentialCustomerByContact(input, connection);
    const lead = (input.email || input.phone || input.instagram)
      ? await upsertPotentialCustomerByContact(
        input,
        {
          source: 'CONTACT_FORM',
          leadStatus: existingLead?.leadStatus || 'NEW',
        },
        connection,
      )
      : null;

    const [insertResult] = await connection.execute(
      `
        INSERT INTO contact_messages (
          first_name,
          last_name,
          birth_date,
          phone,
          instagram,
          email,
          message_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.firstName,
        input.lastName,
        input.birthDate || null,
        input.phone || null,
        input.instagram || null,
        input.email || null,
        input.message,
      ],
    );

    const message = await getContactMessageById(insertResult.insertId, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId || null,
        actorLabel: input.email || `${input.firstName} ${input.lastName}`.trim(),
        actionCode: 'CONTACT_MESSAGE_CREATED',
        entityType: 'contact_messages',
        entityId: message.id,
        afterJson: message,
        metadataJson: {
          potentialCustomerId: lead?.id || null,
        },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return message;
  });
}

export async function listContactMessages({ filters, pagination }) {
  const {
    q,
    search,
    status,
    dateFrom,
    dateTo,
    sortBy,
    sortDir,
  } = filters;
  const { page, pageSize, offset } = pagination;
  const safePageSize = normalizeSqlLimit(pageSize, 25, 100);
  const safeOffset = normalizeSqlOffset(offset);
  const limitOffsetClause = buildSqlLimitOffsetClause(safePageSize, safeOffset, 25, 100);
  const whereClauses = [];
  const params = [];
  const searchTerm = q || search;

  if (status) {
    whereClauses.push('cm.status = ?');
    params.push(status);
  }

  if (searchTerm) {
    whereClauses.push(
      `(
        cm.first_name LIKE ?
        OR cm.last_name LIKE ?
        OR cm.email LIKE ?
        OR cm.phone LIKE ?
        OR cm.instagram LIKE ?
        OR cm.message_text LIKE ?
      )`,
    );
    const like = buildLikeValue(searchTerm);
    params.push(like, like, like, like, like, like);
  }

  appendDateRangeFilters('cm.created_at', { dateFrom, dateTo }, whereClauses, params);

  const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const orderBy = resolveSortClause({
    sortBy,
    sortDir,
    sortMap: CONTACT_MESSAGE_SORTS,
    fallbackKey: 'createdAt',
  });

  const [rows] = await pool.execute(
    `
      SELECT
        cm.id,
        cm.first_name AS firstName,
        cm.last_name AS lastName,
        cm.birth_date AS birthDate,
        cm.phone,
        cm.instagram,
        cm.email,
        cm.message_text AS message,
        cm.status,
        cm.created_at AS createdAt,
        cm.updated_at AS updatedAt,
        cm.handled_by AS handledBy,
        CONCAT_WS(' ', u.first_name, u.last_name) AS handledByName
      FROM contact_messages cm
      LEFT JOIN users u ON u.id = cm.handled_by
      ${where}
      ORDER BY ${orderBy}
      ${limitOffsetClause}
    `,
    params,
  );

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM contact_messages cm ${where}`,
    params,
  );

  return {
    items: rows,
    pagination: {
      page,
      pageSize,
      total: countRows[0].total,
    },
  };
}

export async function updateContactMessageStatus(id, status, auditContext) {
  return withTransaction(async (connection) => {
    const before = await getContactMessageById(id, connection);

    await connection.execute(
      `
        UPDATE contact_messages
        SET
          status = ?,
          handled_by = ?
        WHERE id = ?
      `,
      [status, auditContext.actorUserId || null, id],
    );

    const after = await getContactMessageById(id, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'CONTACT_MESSAGE_STATUS_CHANGED',
        entityType: 'contact_messages',
        entityId: id,
        beforeJson: before,
        afterJson: after,
        metadataJson: { status },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return after;
  });
}

export async function replyContactMessage(id, replyMessage, auditContext) {
  const before = await getContactMessageById(id, pool);

  await sendContactReplyEmail({
    toEmail: before.email,
    toName: `${before.firstName || ''} ${before.lastName || ''}`.trim(),
    message: before.message,
    replyMessage,
  });

  return withTransaction(async (connection) => {
    const original = await getContactMessageById(id, connection);

    await connection.execute(
      `
        UPDATE contact_messages
        SET
          status = 'REPLIED',
          handled_by = ?,
          updated_at = NOW()
        WHERE id = ?
      `,
      [auditContext.actorUserId || null, id],
    );

    const after = await getContactMessageById(id, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'CONTACT_MESSAGE_REPLIED',
        entityType: 'contact_messages',
        entityId: id,
        beforeJson: original,
        afterJson: after,
        metadataJson: {
          replyPreview: replyMessage.slice(0, 280),
        },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return after;
  });
}

export async function getContactMessageById(id, connection = pool) {
  const [rows] = await connection.execute(
    `
      SELECT
        cm.id,
        cm.first_name AS firstName,
        cm.last_name AS lastName,
        cm.birth_date AS birthDate,
        cm.phone,
        cm.instagram,
        cm.email,
        cm.message_text AS message,
        cm.status,
        cm.created_at AS createdAt,
        cm.updated_at AS updatedAt,
        cm.handled_by AS handledBy,
        CONCAT_WS(' ', u.first_name, u.last_name) AS handledByName
      FROM contact_messages cm
      LEFT JOIN users u ON u.id = cm.handled_by
      WHERE cm.id = ?
      LIMIT 1
    `,
    [id],
  );

  if (!rows.length) {
    throw notFound('Contact message not found');
  }

  return rows[0];
}
