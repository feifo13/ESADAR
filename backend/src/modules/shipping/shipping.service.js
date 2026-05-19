import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { badRequest, notFound } from '../../utils/app-error.js';
import { buildLikeValue, resolveSortClause } from '../../utils/listing.js';
import { buildSqlLimitOffsetClause, normalizeSqlLimit, normalizeSqlOffset } from '../../utils/sql-safety.js';
import { logAudit } from '../audit/audit.service.js';
import { SHIPPING_PRICING_TYPES, usesWeightRanges } from './shipping-pricing.js';

const SHIPPING_SORTS = {
  createdAt: (direction) => `sm.created_at ${direction}, sm.id ${direction}`,
  updatedAt: (direction) => `sm.updated_at ${direction}, sm.id ${direction}`,
  description: (direction) => `sm.description ${direction}, sm.id DESC`,
  baseCost: (direction) => `sm.base_cost ${direction}, sm.id DESC`,
  pricingType: (direction) => `sm.pricing_type ${direction}, sm.id DESC`,
  status: (direction) => `sm.is_active ${direction}, sm.id DESC`,
};

function normalizePricingType(value) {
  if (value === SHIPPING_PRICING_TYPES.AHIVA_CORREO_NACIONAL) {
    return SHIPPING_PRICING_TYPES.WEIGHT_RANGES;
  }
  return value || SHIPPING_PRICING_TYPES.FIXED;
}

function normalizeRateRow(row) {
  return {
    id: row.id != null ? Number(row.id) : null,
    minWeightKg: Number(row.minWeightKg || 0),
    maxWeightKg: Number(row.maxWeightKg || 0),
    price: Number(row.price || 0),
    label: row.label || '',
    sortOrder: Number(row.sortOrder || 0),
    isActive: Boolean(row.isActive),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

function normalizeShippingRow(row, rates = []) {
  const pricingType = normalizePricingType(row.pricingType);
  const activeRates = rates.filter((rate) => rate.isActive);
  return {
    id: row.id,
    description: row.description,
    baseCost: Number(row.baseCost || 0),
    pricingType,
    officialRatesLabel: row.officialRatesLabel || null,
    officialRatesUrl: row.officialRatesUrl || null,
    officialRatesFilePath: row.officialRatesFilePath || null,
    instructions: row.instructions || '',
    isActive: Boolean(row.isActive),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    orderCount: Number(row.orderCount || 0),
    rateCount: Number(row.rateCount || activeRates.length || 0),
    minWeightKg: row.minWeightKg != null ? Number(row.minWeightKg) : null,
    maxWeightKg: row.maxWeightKg != null ? Number(row.maxWeightKg) : null,
    rates,
  };
}

function sortRates(rates = []) {
  return [...rates].sort(
    (a, b) =>
      Number(a.sortOrder || 0) - Number(b.sortOrder || 0) ||
      Number(a.minWeightKg || 0) - Number(b.minWeightKg || 0) ||
      Number(a.maxWeightKg || 0) - Number(b.maxWeightKg || 0),
  );
}

function normalizeInputRates(input = []) {
  return sortRates(
    input
      .map((rate, index) => ({
        id: rate.id ? Number(rate.id) : null,
        minWeightKg: Number(rate.minWeightKg || 0),
        maxWeightKg: Number(rate.maxWeightKg || 0),
        price: Number(rate.price || 0),
        label: String(rate.label || '').trim(),
        sortOrder: Number(rate.sortOrder || index + 1),
        isActive: Boolean(rate.isActive ?? true),
      }))
      .filter((rate) => {
        if (rate.isActive) return true;
        return rate.maxWeightKg > rate.minWeightKg && rate.price >= 0;
      }),
  );
}

function validateWeightRates(pricingType, rates = []) {
  if (!usesWeightRanges(pricingType)) return [];

  const normalizedRates = normalizeInputRates(rates);
  const activeRates = normalizedRates.filter((rate) => rate.isActive);

  if (!activeRates.length) {
    throw badRequest('Agrega al menos un rango activo para el método de envío por peso.');
  }

  for (const rate of normalizedRates) {
    if (rate.maxWeightKg <= rate.minWeightKg) {
      throw badRequest('Cada rango debe tener un peso máximo mayor al peso mínimo.');
    }
    if (rate.price < 0) {
      throw badRequest('El precio del rango no puede ser negativo.');
    }
  }

  const sortedActiveRates = sortRates(activeRates);
  for (let index = 1; index < sortedActiveRates.length; index += 1) {
    const previous = sortedActiveRates[index - 1];
    const current = sortedActiveRates[index];
    if (current.minWeightKg < previous.maxWeightKg) {
      throw badRequest('Los rangos de peso no pueden solaparse. Ajusta los valores desde/hasta.');
    }
  }

  return normalizedRates;
}

async function fetchRatesForMethodIds(ids = [], connection = pool, activeOnly = false) {
  const numericIds = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!numericIds.length) return new Map();

  const placeholders = numericIds.map(() => '?').join(', ');
  const activeClause = activeOnly ? 'AND is_active = 1' : '';
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        shipping_method_id AS shippingMethodId,
        min_weight_kg AS minWeightKg,
        max_weight_kg AS maxWeightKg,
        price,
        label,
        sort_order AS sortOrder,
        is_active AS isActive,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM shipping_method_weight_rates
      WHERE shipping_method_id IN (${placeholders})
        ${activeClause}
      ORDER BY shipping_method_id ASC, sort_order ASC, min_weight_kg ASC, max_weight_kg ASC, id ASC
    `,
    numericIds,
  );

  const map = new Map();
  for (const row of rows) {
    const methodId = Number(row.shippingMethodId);
    if (!map.has(methodId)) map.set(methodId, []);
    map.get(methodId).push(normalizeRateRow(row));
  }
  return map;
}

async function getShippingMethodForAdmin(id, connection = pool, options = {}) {
  const lockClause = options.forUpdate ? 'FOR UPDATE' : '';
  const [rows] = await connection.execute(
    `
      SELECT
        sm.id,
        sm.description,
        sm.base_cost AS baseCost,
        sm.pricing_type AS pricingType,
        sm.official_rates_label AS officialRatesLabel,
        sm.official_rates_url AS officialRatesUrl,
        sm.official_rates_file_path AS officialRatesFilePath,
        sm.instructions,
        sm.is_active AS isActive,
        sm.created_at AS createdAt,
        sm.updated_at AS updatedAt,
        (
          SELECT COUNT(*)
          FROM orders o
          WHERE o.shipping_method_id = sm.id
        ) AS orderCount,
        (
          SELECT COUNT(*)
          FROM shipping_method_weight_rates swr
          WHERE swr.shipping_method_id = sm.id
            AND swr.is_active = 1
        ) AS rateCount,
        (
          SELECT MIN(swr.min_weight_kg)
          FROM shipping_method_weight_rates swr
          WHERE swr.shipping_method_id = sm.id
            AND swr.is_active = 1
        ) AS minWeightKg,
        (
          SELECT MAX(swr.max_weight_kg)
          FROM shipping_method_weight_rates swr
          WHERE swr.shipping_method_id = sm.id
            AND swr.is_active = 1
        ) AS maxWeightKg
      FROM shipping_methods sm
      WHERE sm.id = ?
      LIMIT 1
      ${lockClause}
    `,
    [id],
  );

  if (!rows.length) return null;
  const ratesByMethod = await fetchRatesForMethodIds([id], connection);
  return normalizeShippingRow(rows[0], ratesByMethod.get(Number(id)) || []);
}

async function replaceWeightRates(connection, methodId, rates, auditContext) {
  await connection.execute('DELETE FROM shipping_method_weight_rates WHERE shipping_method_id = ?', [methodId]);

  if (!rates.length) return;

  for (const [index, rate] of rates.entries()) {
    await connection.execute(
      `
        INSERT INTO shipping_method_weight_rates (
          shipping_method_id,
          min_weight_kg,
          max_weight_kg,
          price,
          label,
          sort_order,
          is_active,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        methodId,
        rate.minWeightKg,
        rate.maxWeightKg,
        rate.price,
        rate.label || null,
        rate.sortOrder || index + 1,
        rate.isActive ? 1 : 0,
        auditContext.actorUserId || null,
        auditContext.actorUserId || null,
      ],
    );
  }
}

export async function listShippingMethodsForAdmin({ filters, pagination }) {
  const { q, isActive, sortBy, sortDir } = filters;
  const { page, pageSize, offset } = pagination;
  const safePageSize = normalizeSqlLimit(pageSize, 25, 100);
  const safeOffset = normalizeSqlOffset(offset);
  const limitOffsetClause = buildSqlLimitOffsetClause(safePageSize, safeOffset, 25, 100);
  const clauses = [];
  const params = [];

  if (typeof isActive === 'boolean') {
    clauses.push('sm.is_active = ?');
    params.push(isActive ? 1 : 0);
  }

  if (q) {
    const like = buildLikeValue(q);
    clauses.push('(sm.description LIKE ? OR sm.instructions LIKE ?)');
    params.push(like, like);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const orderBy = resolveSortClause({
    sortBy,
    sortDir,
    sortMap: SHIPPING_SORTS,
    fallbackKey: 'createdAt',
  });

  const [rows] = await pool.execute(
    `
      SELECT
        sm.id,
        sm.description,
        sm.base_cost AS baseCost,
        sm.pricing_type AS pricingType,
        sm.official_rates_label AS officialRatesLabel,
        sm.official_rates_url AS officialRatesUrl,
        sm.official_rates_file_path AS officialRatesFilePath,
        sm.instructions,
        sm.is_active AS isActive,
        sm.created_at AS createdAt,
        sm.updated_at AS updatedAt,
        COUNT(DISTINCT o.id) AS orderCount,
        COUNT(DISTINCT CASE WHEN swr.is_active = 1 THEN swr.id END) AS rateCount,
        MIN(CASE WHEN swr.is_active = 1 THEN swr.min_weight_kg END) AS minWeightKg,
        MAX(CASE WHEN swr.is_active = 1 THEN swr.max_weight_kg END) AS maxWeightKg
      FROM shipping_methods sm
      LEFT JOIN orders o ON o.shipping_method_id = sm.id
      LEFT JOIN shipping_method_weight_rates swr ON swr.shipping_method_id = sm.id
      ${where}
      GROUP BY sm.id
      ORDER BY ${orderBy}
      ${limitOffsetClause}
    `,
    params,
  );

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM shipping_methods sm ${where}`,
    params,
  );

  const ratesByMethod = await fetchRatesForMethodIds(rows.map((row) => row.id));

  return {
    items: rows.map((row) => normalizeShippingRow(row, ratesByMethod.get(Number(row.id)) || [])),
    pagination: {
      page,
      pageSize,
      total: countRows[0].total,
    },
  };
}

export async function getShippingMethodDetail(id) {
  const method = await getShippingMethodForAdmin(id);
  if (!method) throw notFound('Metodo de envio no encontrado.');
  return method;
}

export async function createShippingMethod(input, auditContext) {
  return withTransaction(async (connection) => {
    const pricingType = normalizePricingType(input.pricingType);
    const rates = validateWeightRates(pricingType, input.weightRates || []);

    const [insertResult] = await connection.execute(
      `
        INSERT INTO shipping_methods (
          description,
          base_cost,
          pricing_type,
          official_rates_label,
          official_rates_url,
          official_rates_file_path,
          instructions,
          is_active,
          created_by,
          updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.description,
        input.baseCost,
        pricingType,
        input.officialRatesLabel || null,
        input.officialRatesUrl || null,
        input.officialRatesFilePath || null,
        input.instructions || null,
        input.isActive ? 1 : 0,
        auditContext.actorUserId || null,
        auditContext.actorUserId || null,
      ],
    );

    await replaceWeightRates(connection, insertResult.insertId, rates, auditContext);
    const method = await getShippingMethodForAdmin(insertResult.insertId, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'SHIPPING_METHOD_CREATED',
        entityType: 'shipping_methods',
        entityId: insertResult.insertId,
        afterJson: method,
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return method;
  });
}

export async function updateShippingMethod(id, input, auditContext) {
  return withTransaction(async (connection) => {
    const before = await getShippingMethodForAdmin(id, connection, { forUpdate: true });
    if (!before) throw notFound('Metodo de envio no encontrado.');

    const pricingType = normalizePricingType(input.pricingType);
    const rates = validateWeightRates(pricingType, input.weightRates || []);

    await connection.execute(
      `
        UPDATE shipping_methods
        SET
          description = ?,
          base_cost = ?,
          pricing_type = ?,
          official_rates_label = ?,
          official_rates_url = ?,
          official_rates_file_path = ?,
          instructions = ?,
          is_active = ?,
          updated_by = ?
        WHERE id = ?
      `,
      [
        input.description,
        input.baseCost,
        pricingType,
        input.officialRatesLabel || null,
        input.officialRatesUrl || null,
        input.officialRatesFilePath || null,
        input.instructions || null,
        input.isActive ? 1 : 0,
        auditContext.actorUserId || null,
        id,
      ],
    );

    await replaceWeightRates(connection, id, rates, auditContext);
    const after = await getShippingMethodForAdmin(id, connection);

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'SHIPPING_METHOD_UPDATED',
        entityType: 'shipping_methods',
        entityId: id,
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

export async function setShippingMethodActiveStatus(id, isActive, auditContext) {
  return withTransaction(async (connection) => {
    const before = await getShippingMethodForAdmin(id, connection, { forUpdate: true });
    if (!before) throw notFound('Metodo de envio no encontrado.');

    const [result] = await connection.execute(
      `
        UPDATE shipping_methods
        SET is_active = ?, updated_by = ?
        WHERE id = ? AND is_active <> ?
      `,
      [isActive ? 1 : 0, auditContext.actorUserId || null, id, isActive ? 1 : 0],
    );

    const after = result.affectedRows ? await getShippingMethodForAdmin(id, connection) : before;

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: isActive ? 'SHIPPING_METHOD_ACTIVATED' : 'SHIPPING_METHOD_DEACTIVATED',
        entityType: 'shipping_methods',
        entityId: id,
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

export async function deleteShippingMethod(id, auditContext) {
  return withTransaction(async (connection) => {
    const before = await getShippingMethodForAdmin(id, connection, { forUpdate: true });
    if (!before) throw notFound('Metodo de envio no encontrado.');

    try {
      const [deleteResult] = await connection.execute('DELETE FROM shipping_methods WHERE id = ?', [id]);
      if (!deleteResult.affectedRows) throw notFound('Metodo de envio no encontrado.');
    } catch (error) {
      if (error?.code === 'ER_ROW_IS_REFERENCED_2' || error?.errno === 1451) {
        throw badRequest('No se puede eliminar este método porque ya tiene órdenes vinculadas. Puedes desactivarlo.');
      }
      throw error;
    }

    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'SHIPPING_METHOD_DELETED',
        entityType: 'shipping_methods',
        entityId: id,
        beforeJson: before,
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return { deleted: true, method: before };
  });
}
