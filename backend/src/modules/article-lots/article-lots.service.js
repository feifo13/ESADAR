import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { badRequest, conflict, notFound } from '../../utils/app-error.js';
import { buildLikeValue, resolveSortClause } from '../../utils/listing.js';
import { buildSqlLimitOffsetClause, normalizeSqlLimit, normalizeSqlOffset } from '../../utils/sql-safety.js';
import { logAudit } from '../audit/audit.service.js';
import { getCostingSettings } from '../collecting/collecting.service.js';
import { calculateArticlePricing } from '../articles/article-pricing-calculator.js';
import { buildArticleProfitProjectionExport } from '../articles/articles.batch.service.js';

const INITIAL_LOT_CODE = 'LOTE-0001';

const LOT_SORTS = {
  createdAt: (direction) => `al.created_at ${direction}, al.id ${direction}`,
  updatedAt: (direction) => `al.updated_at ${direction}, al.id ${direction}`,
  code: (direction) => `al.code ${direction}, al.id DESC`,
  name: (direction) => `al.name ${direction}, al.id DESC`,
  status: (direction) => `al.status ${direction}, al.id DESC`,
  acquisitionDate: (direction) => `al.acquisition_date ${direction}, al.id DESC`,
  arrivalDate: (direction) => `al.arrival_date ${direction}, al.id DESC`,
};

function normalizeDate(value) {
  return value ? String(value).slice(0, 10) : null;
}

function normalizeLotRow(row) {
  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    description: row.description || null,
    sourceLabel: row.sourceLabel || null,
    acquisitionDate: normalizeDate(row.acquisitionDate),
    arrivalDate: normalizeDate(row.arrivalDate),
    status: row.status,
    notes: row.notes || null,
    createdBy: row.createdBy != null ? Number(row.createdBy) : null,
    updatedBy: row.updatedBy != null ? Number(row.updatedBy) : null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
    articleCount: Number(row.articleCount || 0),
    activeArticleCount: Number(row.activeArticleCount || 0),
    stockTotal: Number(row.stockTotal || 0),
    stockAvailable: Number(row.stockAvailable || 0),
    stockReserved: Number(row.stockReserved || 0),
    stockSold: Number(row.stockSold || 0),
    isInitial: row.code === INITIAL_LOT_CODE,
    isAssignable: row.status !== 'ARCHIVED',
  };
}

function normalizeLotWriteInput(input) {
  return {
    code: String(input.code || '').trim().toUpperCase(),
    name: String(input.name || '').trim(),
    description: input.description || null,
    sourceLabel: input.sourceLabel || null,
    acquisitionDate: normalizeDate(input.acquisitionDate),
    arrivalDate: normalizeDate(input.arrivalDate),
    status: input.status || 'OPEN',
    notes: input.notes || null,
  };
}

function buildLotListFilters(filters = {}) {
  const clauses = [];
  const params = [];

  if (filters.status) {
    clauses.push('al.status = ?');
    params.push(filters.status);
  }

  if (filters.q) {
    const like = buildLikeValue(filters.q);
    clauses.push('(al.code LIKE ? OR al.name LIKE ? OR COALESCE(al.description, \'\') LIKE ? OR COALESCE(al.source_label, \'\') LIKE ?)');
    params.push(like, like, like, like);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

async function getLotById(id, connection = pool, options = {}) {
  const lockClause = options.forUpdate ? 'FOR UPDATE' : '';
  const [rows] = await connection.execute(
    `
      SELECT
        al.id,
        al.code,
        al.name,
        al.description,
        al.source_label AS sourceLabel,
        al.acquisition_date AS acquisitionDate,
        al.arrival_date AS arrivalDate,
        al.status,
        al.notes,
        al.created_by AS createdBy,
        al.updated_by AS updatedBy,
        al.created_at AS createdAt,
        al.updated_at AS updatedAt,
        COUNT(DISTINCT a.id) AS articleCount,
        COUNT(DISTINCT CASE WHEN a.status <> 'ARCHIVED' THEN a.id END) AS activeArticleCount,
        COALESCE(SUM(inv.quantity_total), 0) AS stockTotal,
        COALESCE(SUM(inv.quantity_available), 0) AS stockAvailable,
        COALESCE(SUM(inv.quantity_reserved), 0) AS stockReserved,
        COALESCE(SUM(inv.quantity_sold), 0) AS stockSold
      FROM article_lots al
      LEFT JOIN articles a ON a.lot_id = al.id
      LEFT JOIN article_inventory inv ON inv.article_id = a.id
      WHERE al.id = ?
      GROUP BY al.id
      LIMIT 1
      ${lockClause}
    `,
    [id],
  );

  return rows.length ? normalizeLotRow(rows[0]) : null;
}

export async function getInitialArticleLot(connection = pool) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        code,
        name,
        description,
        source_label AS sourceLabel,
        acquisition_date AS acquisitionDate,
        arrival_date AS arrivalDate,
        status,
        notes,
        created_by AS createdBy,
        updated_by AS updatedBy,
        created_at AS createdAt,
        updated_at AS updatedAt,
        0 AS articleCount,
        0 AS activeArticleCount,
        0 AS stockTotal,
        0 AS stockAvailable,
        0 AS stockReserved,
        0 AS stockSold
      FROM article_lots
      WHERE code = ?
      LIMIT 1
    `,
    [INITIAL_LOT_CODE],
  );

  if (rows.length) return normalizeLotRow(rows[0]);
  throw badRequest('No existe el lote inicial LOTE-0001. Ejecuta la migracion de lotes.');
}

export async function listArticleLotsForAdmin({ filters, pagination }) {
  const { where, params } = buildLotListFilters(filters);
  const safeLimit = normalizeSqlLimit(pagination.limit, 25, 100);
  const safeOffset = normalizeSqlOffset(pagination.offset);
  const limitOffsetClause = buildSqlLimitOffsetClause(safeLimit, safeOffset, 25, 100);
  const orderBy = resolveSortClause({
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    sortMap: LOT_SORTS,
    fallbackKey: 'createdAt',
  });

  const [rows] = await pool.execute(
    `
      SELECT
        al.id,
        al.code,
        al.name,
        al.description,
        al.source_label AS sourceLabel,
        al.acquisition_date AS acquisitionDate,
        al.arrival_date AS arrivalDate,
        al.status,
        al.notes,
        al.created_by AS createdBy,
        al.updated_by AS updatedBy,
        al.created_at AS createdAt,
        al.updated_at AS updatedAt,
        COUNT(DISTINCT a.id) AS articleCount,
        COUNT(DISTINCT CASE WHEN a.status <> 'ARCHIVED' THEN a.id END) AS activeArticleCount,
        COALESCE(SUM(inv.quantity_total), 0) AS stockTotal,
        COALESCE(SUM(inv.quantity_available), 0) AS stockAvailable,
        COALESCE(SUM(inv.quantity_reserved), 0) AS stockReserved,
        COALESCE(SUM(inv.quantity_sold), 0) AS stockSold
      FROM article_lots al
      LEFT JOIN articles a ON a.lot_id = al.id
      LEFT JOIN article_inventory inv ON inv.article_id = a.id
      ${where}
      GROUP BY al.id
      ORDER BY ${orderBy}
      ${limitOffsetClause}
    `,
    params,
  );

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM article_lots al ${where}`,
    params,
  );

  return {
    items: rows.map(normalizeLotRow),
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: countRows[0].total,
    },
  };
}

export async function listArticleLotOptions({ includeArchived = false } = {}) {
  const [rows] = await pool.execute(
    `
      SELECT
        id,
        code,
        name,
        status
      FROM article_lots
      ${includeArchived ? '' : "WHERE status <> 'ARCHIVED'"}
      ORDER BY
        CASE WHEN code = ? THEN 0 ELSE 1 END,
        code ASC,
        id ASC
    `,
    [INITIAL_LOT_CODE],
  );

  return rows.map((row) => ({
    id: Number(row.id),
    code: row.code,
    name: row.name,
    status: row.status,
    label: `${row.code} - ${row.name}`,
    isInitial: row.code === INITIAL_LOT_CODE,
    isAssignable: row.status !== 'ARCHIVED',
  }));
}

export async function getArticleLotDetail(id) {
  const lot = await getLotById(id);
  if (!lot) throw notFound('Lote no encontrado.');
  return lot;
}

export async function createArticleLot(input, auditContext) {
  const payload = normalizeLotWriteInput(input);

  return withTransaction(async (connection) => {
    try {
      const [result] = await connection.execute(
        `
          INSERT INTO article_lots (
            code,
            name,
            description,
            source_label,
            acquisition_date,
            arrival_date,
            status,
            notes,
            created_by,
            updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          payload.code,
          payload.name,
          payload.description,
          payload.sourceLabel,
          payload.acquisitionDate,
          payload.arrivalDate,
          payload.status,
          payload.notes,
          auditContext.actorUserId || null,
          auditContext.actorUserId || null,
        ],
      );

      const lot = await getLotById(result.insertId, connection);
      await logAudit(
        {
          actorUserId: auditContext.actorUserId,
          actorLabel: auditContext.actorLabel,
          actionCode: 'ARTICLE_LOT_CREATED',
          entityType: 'article_lots',
          entityId: result.insertId,
          afterJson: lot,
          source: auditContext.source,
          ipAddress: auditContext.ipAddress,
          userAgent: auditContext.userAgent,
        },
        connection,
      );
      return lot;
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY' || error?.errno === 1062) {
        throw conflict('Ya existe un lote con ese codigo.');
      }
      throw error;
    }
  });
}

export async function updateArticleLot(id, input, auditContext) {
  const payload = normalizeLotWriteInput(input);

  return withTransaction(async (connection) => {
    const before = await getLotById(id, connection, { forUpdate: true });
    if (!before) throw notFound('Lote no encontrado.');

    try {
      await connection.execute(
        `
          UPDATE article_lots
          SET
            code = ?,
            name = ?,
            description = ?,
            source_label = ?,
            acquisition_date = ?,
            arrival_date = ?,
            status = ?,
            notes = ?,
            updated_by = ?
          WHERE id = ?
        `,
        [
          payload.code,
          payload.name,
          payload.description,
          payload.sourceLabel,
          payload.acquisitionDate,
          payload.arrivalDate,
          payload.status,
          payload.notes,
          auditContext.actorUserId || null,
          id,
        ],
      );
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY' || error?.errno === 1062) {
        throw conflict('Ya existe un lote con ese codigo.');
      }
      throw error;
    }

    const after = await getLotById(id, connection);
    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'ARTICLE_LOT_UPDATED',
        entityType: 'article_lots',
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

export async function updateArticleLotStatus(id, status, auditContext) {
  return withTransaction(async (connection) => {
    const before = await getLotById(id, connection, { forUpdate: true });
    if (!before) throw notFound('Lote no encontrado.');

    if (before.code === INITIAL_LOT_CODE && status === 'ARCHIVED' && before.activeArticleCount > 0) {
      throw badRequest('No se puede archivar LOTE-0001 mientras tenga articulos activos asociados.');
    }

    await connection.execute(
      `
        UPDATE article_lots
        SET status = ?, updated_by = ?
        WHERE id = ?
      `,
      [status, auditContext.actorUserId || null, id],
    );

    const after = await getLotById(id, connection);
    await logAudit(
      {
        actorUserId: auditContext.actorUserId,
        actorLabel: auditContext.actorLabel,
        actionCode: 'ARTICLE_LOT_STATUS_UPDATED',
        entityType: 'article_lots',
        entityId: id,
        beforeJson: before,
        afterJson: after,
        metadataJson: { fromStatus: before.status, toStatus: after.status },
        source: auditContext.source,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
      },
      connection,
    );

    return after;
  });
}

async function listLotReportArticles(lotId) {
  const [rows] = await pool.execute(
    `
      SELECT
        a.id,
        a.internal_code AS internalCode,
        a.title,
        a.status,
        a.sale_price AS salePrice,
        a.discount_type AS discountType,
        a.discount_value AS discountValue,
        a.purchase_price_item AS purchasePriceItem,
        a.purchase_price_shipping AS purchasePriceShipping,
        a.purchase_price_courier AS purchasePriceCourier,
        inv.quantity_total AS quantityTotal,
        inv.quantity_available AS quantityAvailable,
        inv.quantity_reserved AS quantityReserved,
        inv.quantity_sold AS quantitySold
      FROM articles a
      INNER JOIN article_inventory inv ON inv.article_id = a.id
      WHERE a.lot_id = ?
      ORDER BY a.intake_date DESC, a.id DESC
    `,
    [lotId],
  );

  return rows;
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function roundPercent(value) {
  return Number(Number(value || 0).toFixed(2));
}

function getProjectionResult(estimatedProfit) {
  const cents = Math.round(Number(estimatedProfit || 0) * 100);
  if (cents > 0) return 'profit';
  if (cents < 0) return 'loss';
  return 'breakEven';
}

function buildLotReportSummary(rows, costingSettings) {
  const totals = rows.reduce(
    (accumulator, row) => {
      const metrics = calculateArticlePricing(row, {
        bankTaxRate: costingSettings.bankTaxRate,
      });
      const result = getProjectionResult(metrics.estimatedProfit);

      accumulator.articleCount += 1;
      accumulator.stockTotal += Number(row.quantityTotal || 0);
      accumulator.stockAvailable += Number(row.quantityAvailable || 0);
      accumulator.stockReserved += Number(row.quantityReserved || 0);
      accumulator.stockSold += Number(row.quantitySold || 0);
      accumulator.totalSalePrice += metrics.salePrice;
      accumulator.totalEffectiveSalePrice += metrics.effectiveSalePrice;
      accumulator.totalPurchasePriceItem += metrics.purchasePriceItem;
      accumulator.totalPurchasePriceShipping += metrics.purchasePriceShipping;
      accumulator.totalPurchasePriceCourier += metrics.purchasePriceCourier;
      accumulator.totalPurchasePriceTotal += metrics.purchasePriceTotal;
      accumulator.totalBankTaxBase += metrics.bankTaxBase;
      accumulator.totalBankTax += metrics.bankTax;
      accumulator.totalCost += metrics.totalCost;
      accumulator.totalEstimatedProfit += metrics.estimatedProfit;
      if (result === 'profit') accumulator.profitCount += 1;
      if (result === 'loss') accumulator.lossCount += 1;
      if (result === 'breakEven') accumulator.breakEvenCount += 1;
      return accumulator;
    },
    {
      articleCount: 0,
      stockTotal: 0,
      stockAvailable: 0,
      stockReserved: 0,
      stockSold: 0,
      totalSalePrice: 0,
      totalEffectiveSalePrice: 0,
      totalPurchasePriceItem: 0,
      totalPurchasePriceShipping: 0,
      totalPurchasePriceCourier: 0,
      totalPurchasePriceTotal: 0,
      totalBankTaxBase: 0,
      totalBankTax: 0,
      totalCost: 0,
      totalEstimatedProfit: 0,
      profitCount: 0,
      lossCount: 0,
      breakEvenCount: 0,
    },
  );

  return {
    articleCount: totals.articleCount,
    stockTotal: totals.stockTotal,
    stockAvailable: totals.stockAvailable,
    stockReserved: totals.stockReserved,
    stockSold: totals.stockSold,
    totalSalePrice: roundMoney(totals.totalSalePrice),
    totalEffectiveSalePrice: roundMoney(totals.totalEffectiveSalePrice),
    totalPurchasePriceItem: roundMoney(totals.totalPurchasePriceItem),
    totalPurchasePriceShipping: roundMoney(totals.totalPurchasePriceShipping),
    totalPurchasePriceCourier: roundMoney(totals.totalPurchasePriceCourier),
    totalPurchasePriceTotal: roundMoney(totals.totalPurchasePriceTotal),
    totalBankTaxBase: roundMoney(totals.totalBankTaxBase),
    totalBankTax: roundMoney(totals.totalBankTax),
    totalCost: roundMoney(totals.totalCost),
    totalEstimatedProfit: roundMoney(totals.totalEstimatedProfit),
    weightedEstimatedMargin: totals.totalEffectiveSalePrice > 0
      ? roundPercent((totals.totalEstimatedProfit / totals.totalEffectiveSalePrice) * 100)
      : 0,
    profitCount: totals.profitCount,
    lossCount: totals.lossCount,
    breakEvenCount: totals.breakEvenCount,
  };
}

export async function getArticleLotReport(id) {
  const lot = await getArticleLotDetail(id);
  const [articles, costingSettings] = await Promise.all([
    listLotReportArticles(id),
    getCostingSettings(),
  ]);

  return {
    lot,
    summary: buildLotReportSummary(articles, costingSettings),
  };
}

export async function exportArticleLotProfitProjection({ id, format, auditContext }) {
  const lot = await getArticleLotDetail(id);
  return buildArticleProfitProjectionExport({
    filters: { lotId: id },
    format,
    auditContext,
    lot,
    auditActionCode: 'ARTICLE_LOT_EXPORT_CREATED',
    auditEntityType: 'article_lots',
    auditEntityId: id,
  });
}
