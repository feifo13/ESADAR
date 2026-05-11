import { pool } from '../../db/pool.js';
import { appendDateRangeFilters, buildLikeValue, resolveSortClause } from '../../utils/listing.js';
import { buildSqlLimitOffsetClause, normalizeSqlLimit, normalizeSqlOffset } from '../../utils/sql-safety.js';

const AUDIT_SORTS = {
  createdAt: (direction) => `al.created_at ${direction}, al.id ${direction}`,
  actionCode: (direction) => `al.action_code ${direction}, al.id DESC`,
  actorLabel: (direction) => `al.actor_label ${direction}, al.id DESC`,
  entityType: (direction) => `al.entity_type ${direction}, al.id DESC`,
  source: (direction) => `al.source ${direction}, al.id DESC`,
};

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

export async function listAudit({ page, pageSize, offset, q, source, entityType, actionCode, dateFrom, dateTo, sortBy, sortDir }) {
  const clauses = [];
  const params = [];
  const safePageSize = normalizeSqlLimit(pageSize, 25, 100);
  const safeOffset = normalizeSqlOffset(offset);
  const limitOffsetClause = buildSqlLimitOffsetClause(safePageSize, safeOffset, 25, 100);

  if (q) {
    const like = buildLikeValue(q);
    clauses.push(`(
      al.actor_label LIKE ?
      OR al.action_code LIKE ?
      OR al.entity_type LIKE ?
      OR al.entity_id LIKE ?
      OR al.source LIKE ?
    )`);
    params.push(like, like, like, like, like);
  }

  if (source) {
    clauses.push('al.source = ?');
    params.push(source);
  }

  if (entityType) {
    clauses.push('al.entity_type = ?');
    params.push(entityType);
  }

  if (actionCode) {
    clauses.push('al.action_code = ?');
    params.push(actionCode);
  }

  appendDateRangeFilters('al.created_at', { dateFrom, dateTo }, clauses, params);

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const orderBy = resolveSortClause({
    sortBy,
    sortDir,
    sortMap: AUDIT_SORTS,
    fallbackKey: 'createdAt',
  });

  const [rows] = await pool.execute(
    `
      SELECT
        al.id,
        al.actor_user_id AS actorUserId,
        al.actor_label AS actorLabel,
        al.action_code AS actionCode,
        al.entity_type AS entityType,
        al.entity_id AS entityId,
        al.source,
        al.ip_address AS ipAddress,
        al.user_agent AS userAgent,
        al.created_at AS createdAt
      FROM audit_log al
      ${where}
      ORDER BY ${orderBy}
      ${limitOffsetClause}
    `,
    params,
  );

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM audit_log al ${where}`,
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
