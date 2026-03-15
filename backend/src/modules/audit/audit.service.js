import { pool } from '../../db/pool.js';

export async function logAudit(input, connection = pool) {
  const sql = `
    INSERT INTO audit_log (
      actor_user_id,
      actor_label,
      action_code,
      entity_type,
      entity_id,
      before_json,
      after_json,
      metadata_json,
      source,
      ip_address,
      user_agent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    input.actorUserId || null,
    input.actorLabel || null,
    input.actionCode,
    input.entityType,
    input.entityId != null ? String(input.entityId) : null,
    input.beforeJson ? JSON.stringify(input.beforeJson) : null,
    input.afterJson ? JSON.stringify(input.afterJson) : null,
    input.metadataJson ? JSON.stringify(input.metadataJson) : null,
    input.source || 'API',
    input.ipAddress || null,
    input.userAgent || null,
  ];

  await connection.execute(sql, params);
}

export async function listAudit({ page, pageSize, offset }) {
  const [rows] = await pool.query(
    `
      SELECT
        id,
        actor_user_id AS actorUserId,
        actor_label AS actorLabel,
        action_code AS actionCode,
        entity_type AS entityType,
        entity_id AS entityId,
        source,
        ip_address AS ipAddress,
        user_agent AS userAgent,
        created_at AS createdAt
      FROM audit_log
      ORDER BY id DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
  );

  const [countRows] = await pool.execute('SELECT COUNT(*) AS total FROM audit_log');

  return {
    items: rows,
    pagination: {
      page,
      pageSize,
      total: countRows[0].total,
    },
  };
}
