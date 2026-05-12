import { pool } from '../../db/pool.js';
import { buildLikeValue, resolveSortClause } from '../../utils/listing.js';
import { buildSqlLimitOffsetClause, normalizeSqlLimit, normalizeSqlOffset } from '../../utils/sql-safety.js';

const CLIENT_LOG_SORTS = {
  createdAt: (direction) => `created_at ${direction}, id ${direction}`,
  level: (direction) => `level ${direction}, id DESC`,
  type: (direction) => `type ${direction}, id DESC`,
  statusCode: (direction) => `status_code ${direction}, id DESC`,
};

function truncate(value, maxLength) {
  const text = value == null ? '' : String(value);
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function serializeMetadata(metadata) {
  if (metadata == null || metadata === '') return null;
  try {
    return truncate(JSON.stringify(metadata), 6000);
  } catch {
    return null;
  }
}

function normalizeLogRow(row) {
  return {
    id: Number(row.id),
    level: row.level,
    type: row.type,
    message: row.message,
    stack: row.stack,
    route: row.route,
    userAgent: row.userAgent,
    statusCode: row.statusCode != null ? Number(row.statusCode) : null,
    requestId: row.requestId,
    ipAddress: row.ipAddress,
    metadata: row.metadataJson || null,
    createdAt: row.createdAt,
  };
}

export async function createClientLog(input, context = {}) {
  const payload = {
    level: truncate(input.level || 'error', 30),
    type: truncate(input.type || 'ClientError', 120),
    message: truncate(input.message, 500),
    stack: truncate(input.stack || '', 4000),
    route: truncate(input.route || '', 500),
    userAgent: truncate(input.userAgent || context.userAgent || '', 500),
    statusCode: input.statusCode || null,
    requestId: truncate(input.requestId || context.requestId || '', 120),
    metadataJson: serializeMetadata(input.metadata),
    ipAddress: truncate(context.ipAddress || '', 64),
  };

  const [result] = await pool.execute(
    `
      INSERT INTO client_error_logs (
        level,
        type,
        message,
        stack,
        route,
        user_agent,
        status_code,
        request_id,
        metadata_json,
        ip_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.level,
      payload.type,
      payload.message,
      payload.stack || null,
      payload.route || null,
      payload.userAgent || null,
      payload.statusCode,
      payload.requestId || null,
      payload.metadataJson,
      payload.ipAddress || null,
    ],
  );

  console.error('[client-log]', {
    id: result.insertId,
    level: payload.level,
    type: payload.type,
    message: payload.message,
    route: payload.route,
    statusCode: payload.statusCode,
    requestId: payload.requestId,
  });

  return { id: Number(result.insertId) };
}

export async function listClientLogs({ filters, pagination }) {
  const { q, level, type, sortBy, sortDir } = filters;
  const { page, pageSize, offset } = pagination;
  const safePageSize = normalizeSqlLimit(pageSize, 25, 100);
  const safeOffset = normalizeSqlOffset(offset);
  const limitOffsetClause = buildSqlLimitOffsetClause(safePageSize, safeOffset, 25, 100);
  const clauses = [];
  const params = [];

  if (q) {
    const like = buildLikeValue(q);
    clauses.push('(message LIKE ? OR type LIKE ? OR route LIKE ? OR request_id LIKE ?)');
    params.push(like, like, like, like);
  }
  if (level) {
    clauses.push('level = ?');
    params.push(level);
  }
  if (type) {
    clauses.push('type = ?');
    params.push(type);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const orderBy = resolveSortClause({ sortBy, sortDir, sortMap: CLIENT_LOG_SORTS, fallbackKey: 'createdAt' });

  const [rows] = await pool.execute(
    `
      SELECT
        id,
        level,
        type,
        message,
        stack,
        route,
        user_agent AS userAgent,
        status_code AS statusCode,
        request_id AS requestId,
        ip_address AS ipAddress,
        metadata_json AS metadataJson,
        created_at AS createdAt
      FROM client_error_logs
      ${where}
      ORDER BY ${orderBy}
      ${limitOffsetClause}
    `,
    params,
  );

  const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM client_error_logs ${where}`, params);

  return {
    items: rows.map(normalizeLogRow),
    pagination: { page, pageSize, total: countRows[0].total },
  };
}
