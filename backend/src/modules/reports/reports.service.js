import { pool } from '../../db/pool.js';
import { buildLikeValue } from '../../utils/listing.js';
import { buildSqlPlaceholders } from '../../utils/sql-safety.js';
import { logAudit } from '../audit/audit.service.js';
import { getCostingSettings } from '../collecting/collecting.service.js';
import { listAdminArticlesForExport } from '../articles/articles.service.js';
import { deriveStockStatus } from '../inventory/inventory.constants.js';
import { getCanonicalCompletedSaleStatusParameters } from './completed-sales.js';
import { buildCanonicalSalesProjection } from './sales.projection.js';
import { buildCanonicalProfitProjection } from './profit-projection.report.js';
import { buildCanonicalRealizedProfitProjection } from './realized-profit.projection.js';
import {
  buildCurrentStockProjection,
  buildStockRotationV1Projection,
  projectStockRotationV1Row,
} from './stock.projection.js';
import {
  COST_INTEGRITY_SCOPES,
  buildCanonicalCostIntegrityProjection,
} from './cost-integrity.projection.js';
import {
  renderReportProjectionCsv,
  renderReportProjectionXlsx,
} from './report-renderers.js';

export const REPORT_IDS = Object.freeze([
  'sales',
  'profit-projection',
  'realized-profits',
  'stock',
  'stock-rotation',
  'cost-integrity',
]);

const REPORT_FILE_STEMS = Object.freeze({
  sales: 'esadar-ventas',
  'profit-projection': 'esadar-proyeccion-ganancias',
  'realized-profits': 'esadar-ganancias',
  stock: 'esadar-stock',
  'stock-rotation': 'esadar-rotacion-stock',
  'cost-integrity': 'esadar-integridad-costos',
});

const MIME_TYPES = Object.freeze({
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
});

const SAFE_AUDIT_FILTER_KEYS = new Set([
  'dateFrom',
  'dateTo',
  'lotId',
  'categoryId',
  'brandId',
  'sizeId',
  'paymentMethod',
  'publicationStatus',
  'stockStatus',
  'featured',
  'offerable',
  'dataQuality',
  'minDays',
  'historyScope',
  'hasRecordedSale',
  'scope',
  'issueCode',
  'unreliableOnly',
]);

function buildHistoricalWhere(filters = {}) {
  const statuses = getCanonicalCompletedSaleStatusParameters();
  const clauses = [
    `o.order_status IN (${buildSqlPlaceholders(statuses)})`,
    'o.approved_at IS NOT NULL',
  ];
  const params = [...statuses];

  if (filters.dateFrom) {
    clauses.push('DATE(o.approved_at) >= ?');
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    clauses.push('DATE(o.approved_at) <= ?');
    params.push(filters.dateTo);
  }
  if (filters.lotId) {
    clauses.push('oi.lot_id_snapshot = ?');
    params.push(filters.lotId);
  }
  if (filters.paymentMethod) {
    clauses.push('o.payment_method = ?');
    params.push(filters.paymentMethod);
  }
  if (filters.shippingMethod) {
    clauses.push('o.shipping_method_description_snapshot = ?');
    params.push(filters.shippingMethod);
  }
  if (filters.q) {
    const like = buildLikeValue(filters.q);
    clauses.push(`(
      o.order_number LIKE ?
      OR oi.article_title_snapshot LIKE ?
      OR COALESCE(oi.lot_code_snapshot, '') LIKE ?
      OR COALESCE(oi.lot_name_snapshot, '') LIKE ?
    )`);
    params.push(like, like, like, like);
  }

  return { clauses, params };
}

export function buildHistoricalSaleReportQuery(filters = {}) {
  const { clauses, params } = buildHistoricalWhere(filters);
  return {
    sql: `
      SELECT
        o.order_number AS orderNumber,
        o.order_status AS orderStatus,
        o.approved_at AS approvedAt,
        o.payment_method AS paymentMethod,
        o.shipping_method_description_snapshot AS shippingMethodDescriptionSnapshot,
        oi.quantity,
        oi.article_title_snapshot AS articleTitleSnapshot,
        oi.category_name_snapshot AS categoryNameSnapshot,
        oi.brand_name_snapshot AS brandNameSnapshot,
        oi.lot_id_snapshot AS lotIdSnapshot,
        oi.lot_code_snapshot AS lotCodeSnapshot,
        oi.lot_name_snapshot AS lotNameSnapshot,
        oi.sale_price_snapshot AS salePriceSnapshot,
        oi.final_unit_price_snapshot AS finalUnitPriceSnapshot,
        oi.line_total_snapshot AS lineTotalSnapshot,
        oi.purchase_price_item_snapshot AS purchasePriceItemSnapshot,
        oi.purchase_price_shipping_snapshot AS purchasePriceShippingSnapshot,
        oi.purchase_price_courier_snapshot AS purchasePriceCourierSnapshot,
        oi.purchase_price_total_snapshot AS purchasePriceTotalSnapshot,
        oi.bank_tax_rate_snapshot AS bankTaxRateSnapshot,
        oi.bank_tax_base_snapshot AS bankTaxBaseSnapshot,
        oi.bank_tax_snapshot AS bankTaxSnapshot,
        oi.total_cost_snapshot AS totalCostSnapshot,
        oi.profit_snapshot AS profitSnapshot
      FROM orders o
      INNER JOIN order_items oi ON oi.order_id = o.id
      WHERE ${clauses.join('\n        AND ')}
      ORDER BY o.approved_at DESC, o.id DESC, oi.id ASC
    `,
    params,
  };
}

export async function listHistoricalSaleReportRows(filters = {}, connection = pool) {
  const query = buildHistoricalSaleReportQuery(filters);
  const [rows] = await connection.execute(query.sql, query.params);
  return rows;
}

function toCurrentArticleFilters(filters = {}) {
  return {
    q: filters.q,
    lotId: filters.lotId,
    categoryId: filters.categoryId,
    brandId: filters.brandId,
    sizeId: filters.sizeId,
    status: filters.publicationStatus,
    featured: filters.featured,
    offerable: filters.offerable,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    sortBy: 'intakeDate',
    sortDir: 'desc',
  };
}

function filterCurrentArticleStockStatus(rows, stockStatus) {
  if (!stockStatus) return rows;
  return rows.filter((row) => deriveStockStatus(row) === stockStatus);
}

async function listCurrentArticleRows(filters, dependencies) {
  const rows = await dependencies.listArticles({
    filters: toCurrentArticleFilters(filters),
  });
  return filterCurrentArticleStockStatus(rows, filters.stockStatus);
}

export async function listInventoryHistoryByArticleIds(articleIds, connection = pool) {
  const safeIds = [...new Set((articleIds || [])
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0))];
  if (!safeIds.length) return new Map();

  const [rows] = await connection.execute(
    `
      SELECT
        article_id AS articleId,
        movement_type AS movementType,
        reason,
        created_at AS createdAt
      FROM article_inventory_movements
      WHERE article_id IN (${buildSqlPlaceholders(safeIds)})
        AND movement_type IN ('INITIAL_STOCK', 'SALE', 'RETURN', 'MANUAL_ADJUSTMENT')
      ORDER BY article_id ASC, created_at ASC, id ASC
    `,
    safeIds,
  );

  const historyByArticleId = new Map();
  for (const row of rows) {
    const articleId = Number(row.articleId);
    const history = historyByArticleId.get(articleId) || {
      hasInitialStockMovement: false,
      initialMovementAt: null,
      initialMovementReason: null,
      saleMovementCount: 0,
      returnMovementCount: 0,
      adjustmentMovementCount: 0,
      lastRecordedSaleAt: null,
    };
    if (row.movementType === 'INITIAL_STOCK' && !history.hasInitialStockMovement) {
      history.hasInitialStockMovement = true;
      history.initialMovementAt = row.createdAt || null;
      history.initialMovementReason = row.reason || null;
    }
    if (row.movementType === 'SALE') {
      history.saleMovementCount += 1;
      history.lastRecordedSaleAt = row.createdAt || history.lastRecordedSaleAt;
    }
    if (row.movementType === 'RETURN') history.returnMovementCount += 1;
    if (row.movementType === 'MANUAL_ADJUSTMENT') history.adjustmentMovementCount += 1;
    historyByArticleId.set(articleId, history);
  }

  return historyByArticleId;
}

function filterRotationRows(rows, filters, asOfDate) {
  return rows.filter((row) => {
    const projected = projectStockRotationV1Row(row, { asOfDate });
    if (filters.minDays != null
      && (projected.daysSinceIntake == null || projected.daysSinceIntake < filters.minDays)) {
      return false;
    }
    if (filters.historyScope && projected.historyScope !== filters.historyScope) return false;
    if (filters.hasRecordedSale === true && !projected.lastRecordedSaleAt) return false;
    if (filters.hasRecordedSale === false && projected.lastRecordedSaleAt) return false;
    return true;
  });
}

export function sanitizeReportAuditFilters(filters = {}) {
  const safeFilters = {};
  for (const [key, value] of Object.entries(filters)) {
    if (SAFE_AUDIT_FILTER_KEYS.has(key) && value !== undefined) safeFilters[key] = value;
  }
  if (filters.q) safeFilters.hasCommercialSearch = true;
  if (filters.shippingMethod) safeFilters.hasShippingMethodFilter = true;
  return safeFilters;
}

const defaultDependencies = Object.freeze({
  connection: pool,
  listArticles: listAdminArticlesForExport,
  getCostingSettings,
  logAudit,
  now: () => new Date(),
});

function mergeDependencies(dependencies = {}) {
  return { ...defaultDependencies, ...dependencies };
}

export async function buildReportProjection(reportId, filters = {}, dependencyOverrides = {}) {
  const dependencies = mergeDependencies(dependencyOverrides);

  if (reportId === 'sales') {
    const rows = await listHistoricalSaleReportRows(filters, dependencies.connection);
    return buildCanonicalSalesProjection(rows);
  }

  if (reportId === 'profit-projection') {
    const [rows, costingSettings] = await Promise.all([
      listCurrentArticleRows(filters, dependencies),
      dependencies.getCostingSettings(dependencies.connection),
    ]);
    return buildCanonicalProfitProjection(rows, costingSettings);
  }

  if (reportId === 'realized-profits') {
    const rows = await listHistoricalSaleReportRows(filters, dependencies.connection);
    return buildCanonicalRealizedProfitProjection(rows, {
      dataQuality: filters.dataQuality,
    });
  }

  if (reportId === 'stock') {
    const rows = await listCurrentArticleRows(filters, dependencies);
    return buildCurrentStockProjection(rows);
  }

  if (reportId === 'stock-rotation') {
    const rows = await listCurrentArticleRows(filters, dependencies);
    const history = await listInventoryHistoryByArticleIds(
      rows.map(({ id }) => id),
      dependencies.connection,
    );
    const enrichedRows = rows.map((row) => ({
      ...row,
      ...(history.get(Number(row.id)) || {}),
    }));
    const asOfDate = dependencies.now();
    return buildStockRotationV1Projection(
      filterRotationRows(enrichedRows, filters, asOfDate),
      { asOfDate },
    );
  }

  if (reportId === 'cost-integrity') {
    const includeCurrent = filters.scope !== COST_INTEGRITY_SCOPES.HISTORICAL_SALES;
    const includeHistorical = filters.scope !== COST_INTEGRITY_SCOPES.CURRENT_ARTICLES;
    const [currentArticles, historicalSales, costingSettings] = await Promise.all([
      includeCurrent ? listCurrentArticleRows(filters, dependencies) : [],
      includeHistorical
        ? listHistoricalSaleReportRows(filters, dependencies.connection)
        : [],
      includeCurrent
        ? dependencies.getCostingSettings(dependencies.connection)
        : {},
    ]);
    return buildCanonicalCostIntegrityProjection({
      currentArticles,
      historicalSales,
      costingSettings,
      filters,
    });
  }

  throw new TypeError(`Unsupported canonical report: ${reportId}`);
}

export async function buildReportDownload({
  reportId,
  query,
  auditContext,
  dependencies: dependencyOverrides = {},
}) {
  const dependencies = mergeDependencies(dependencyOverrides);
  const { format = 'xlsx', ...filters } = query;
  const projection = await buildReportProjection(reportId, filters, dependencies);
  const payload = format === 'csv'
    ? renderReportProjectionCsv(projection)
    : await renderReportProjectionXlsx(projection, { sheetName: 'Reporte' });
  const today = dependencies.now().toISOString().slice(0, 10);
  const fileName = `${REPORT_FILE_STEMS[reportId]}-${today}.${format}`;

  await dependencies.logAudit({
    actorUserId: auditContext.actorUserId,
    actorLabel: auditContext.actorLabel,
    actionCode: 'REPORT_EXPORT_CREATED',
    entityType: 'reports',
    entityId: null,
    metadataJson: {
      reportId,
      format,
      rowCount: projection.rows.length,
      filters: sanitizeReportAuditFilters(filters),
    },
    source: auditContext.source,
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
  }, dependencies.connection);

  return {
    contentType: MIME_TYPES[format],
    fileName,
    payload,
    itemCount: projection.rows.length,
    projection,
  };
}
