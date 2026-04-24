import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { notFound } from '../../utils/app-error.js';
import { logAudit } from '../audit/audit.service.js';

export async function createContactMessage(input, auditContext) {
  return withTransaction(async (connection) => {
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
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return message;
  });
}

export async function listContactMessages({ page, pageSize, offset, status, search }) {
  const whereClauses = [];
  const params = [];

  if (status) {
    whereClauses.push('cm.status = ?');
    params.push(status);
  }

  if (search) {
    whereClauses.push(
      '(cm.first_name LIKE ? OR cm.last_name LIKE ? OR cm.email LIKE ? OR cm.message_text LIKE ?)',
    );
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [rows] = await pool.query(
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
      ORDER BY cm.id DESC
      LIMIT ${pageSize} OFFSET ${offset}
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

async function getContactMessageById(id, connection) {
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
