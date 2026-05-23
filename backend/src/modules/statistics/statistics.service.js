import { createWorkbook, workbookToXlsxBuffer } from '../../utils/export-files.js';
import { pool } from '../../db/pool.js';
import { appendDateRangeFilters, buildLikeValue } from '../../utils/listing.js';
import { buildSqlLimitClause } from '../../utils/sql-safety.js';
import { BANK_TAX_RATE } from './statistics.margin-calculator.js';
import {
  getAdminWishlistSummary,
  getAdminWishlistTopArticles,
  getAdminWishlistTopUsers,
} from '../wishlists/wishlists.service.js';

const ORDER_ITEM_COST_ITEM_EXPR = 'COALESCE(oi.purchase_price_item_snapshot, COALESCE(a.purchase_price_item, 0) * oi.quantity)';
const ORDER_ITEM_COST_USA_EXPR = 'COALESCE(oi.purchase_price_shipping_snapshot, COALESCE(a.purchase_price_shipping, 0) * oi.quantity)';
const ORDER_ITEM_COST_MVD_EXPR = 'COALESCE(oi.purchase_price_courier_snapshot, COALESCE(a.purchase_price_courier, 0) * oi.quantity)';
const ORDER_ITEM_COST_TOTAL_EXPR = `COALESCE(oi.purchase_price_total_snapshot, ${ORDER_ITEM_COST_ITEM_EXPR} + ${ORDER_ITEM_COST_USA_EXPR} + ${ORDER_ITEM_COST_MVD_EXPR})`;
const ORDER_ITEM_BANK_TAX_EXPR = `ROUND((${ORDER_ITEM_COST_ITEM_EXPR} + ${ORDER_ITEM_COST_USA_EXPR}) * ${BANK_TAX_RATE}, 2)`;
const ORDER_ITEM_TOTAL_COST_EXPR = `(${ORDER_ITEM_COST_TOTAL_EXPR} + ${ORDER_ITEM_BANK_TAX_EXPR})`;
const ORDER_ITEM_PROFIT_EXPR = `(COALESCE(oi.profit_snapshot, oi.line_total_snapshot - ${ORDER_ITEM_COST_TOTAL_EXPR}) - ${ORDER_ITEM_BANK_TAX_EXPR})`;
const ORDER_ITEM_INCOMPLETE_COST_EXPR = `CASE WHEN ${ORDER_ITEM_COST_TOTAL_EXPR} <= 0 THEN 1 ELSE 0 END`;

function normalizePositiveInt(value, fallback, max = 50) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.min(max, Math.floor(numeric));
}

function buildCompletedOrderFilters(filters = {}) {
  const clauses = [];
  const params = [];

  if (filters.status) {
    clauses.push('o.order_status = ?');
    params.push(filters.status);
  } else {
    clauses.push(`o.order_status IN ('APPROVED', 'SHIPPED')`);
  }

  appendDateRangeFilters('COALESCE(o.approved_at, o.shipped_at, o.created_at)', filters, clauses, params);

  if (filters.paymentMethod) {
    clauses.push('o.payment_method = ?');
    params.push(filters.paymentMethod);
  }

  if (filters.shippingMethod) {
    clauses.push('o.shipping_method_id = ?');
    params.push(filters.shippingMethod);
  }

  if (filters.categoryId) {
    clauses.push(`EXISTS (
      SELECT 1
      FROM order_items oi_category
      INNER JOIN articles a_category ON a_category.id = oi_category.article_id
      WHERE oi_category.order_id = o.id
        AND a_category.category_id = ?
    )`);
    params.push(filters.categoryId);
  }

  if (filters.brandId) {
    clauses.push(`EXISTS (
      SELECT 1
      FROM order_items oi_brand
      INNER JOIN articles a_brand ON a_brand.id = oi_brand.article_id
      WHERE oi_brand.order_id = o.id
        AND a_brand.brand_id = ?
    )`);
    params.push(filters.brandId);
  }

  if (filters.q) {
    const like = buildLikeValue(filters.q);
    clauses.push(`(
      o.order_number LIKE ?
      OR EXISTS (
        SELECT 1
        FROM order_items oi_search
        INNER JOIN articles a_search ON a_search.id = oi_search.article_id
        WHERE oi_search.order_id = o.id
          AND (a_search.title LIKE ? OR a_search.internal_code LIKE ?)
      )
      OR COALESCE(c.first_name, pc.first_name, '') LIKE ?
      OR COALESCE(c.last_name, pc.last_name, '') LIKE ?
      OR COALESCE(c.email, pc.email, '') LIKE ?
      OR COALESCE(c.phone, pc.phone, '') LIKE ?
    )`);
    params.push(like, like, like, like, like, like, like);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

function buildSalesItemFilters(filters = {}) {
  const clauses = [];
  const params = [];

  if (filters.status) {
    clauses.push('o.order_status = ?');
    params.push(filters.status);
  } else {
    clauses.push(`o.order_status IN ('APPROVED', 'SHIPPED')`);
  }

  appendDateRangeFilters('COALESCE(o.approved_at, o.shipped_at, o.created_at)', filters, clauses, params);

  if (filters.paymentMethod) {
    clauses.push('o.payment_method = ?');
    params.push(filters.paymentMethod);
  }

  if (filters.shippingMethod) {
    clauses.push('o.shipping_method_id = ?');
    params.push(filters.shippingMethod);
  }

  if (filters.categoryId) {
    clauses.push('a.category_id = ?');
    params.push(filters.categoryId);
  }

  if (filters.brandId) {
    clauses.push('a.brand_id = ?');
    params.push(filters.brandId);
  }

  if (filters.q) {
    const like = buildLikeValue(filters.q);
    clauses.push(`(
      a.title LIKE ?
      OR a.internal_code LIKE ?
      OR oi.article_title_snapshot LIKE ?
      OR COALESCE(c.first_name, pc.first_name, '') LIKE ?
      OR COALESCE(c.last_name, pc.last_name, '') LIKE ?
      OR o.order_number LIKE ?
    )`);
    params.push(like, like, like, like, like, like);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

function buildWishlistFiltersForStats(filters = {}) {
  return {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    categoryId: filters.categoryId,
    brandId: filters.brandId,
    status: filters.status && ['ACTIVE', 'INACTIVE', 'RESERVED', 'SOLD_OUT'].includes(filters.status)
      ? filters.status
      : undefined,
  };
}

async function getOrderTotals(filters = {}) {
  const { where, params } = buildCompletedOrderFilters(filters);
  const [rows] = await pool.execute(
    `
      SELECT
        COUNT(DISTINCT o.id) AS totalOrders,
        COALESCE(SUM(o.total_snapshot), 0) AS grossRevenue,
        COALESCE(AVG(o.total_snapshot), 0) AS averageTicket
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN potential_customers pc ON pc.id = o.potential_customer_id
      ${where}
    `,
    params,
  );

  return rows[0] || {};
}

async function getSalesItemTotals(filters = {}) {
  const { where, params } = buildSalesItemFilters(filters);
  const [rows] = await pool.execute(
    `
      SELECT
        COALESCE(SUM(oi.quantity), 0) AS itemsSold,
        COALESCE(SUM(oi.line_total_snapshot), 0) AS itemsRevenue,
        COALESCE(SUM(${ORDER_ITEM_BANK_TAX_EXPR}), 0) AS bankTax,
        COALESCE(SUM(${ORDER_ITEM_TOTAL_COST_EXPR}), 0) AS totalCost,
        COALESCE(SUM(${ORDER_ITEM_PROFIT_EXPR}), 0) AS estimatedProfit,
        COALESCE(SUM(${ORDER_ITEM_INCOMPLETE_COST_EXPR}), 0) AS incompleteCostRows
      FROM orders o
      INNER JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN articles a ON a.id = oi.article_id
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN potential_customers pc ON pc.id = o.potential_customer_id
      ${where}
    `,
    params,
  );

  return rows[0] || {};
}

export async function getStatisticsTopArticles(filters = {}, limit = 10) {
  const { where, params } = buildSalesItemFilters(filters);
  const safeLimit = normalizePositiveInt(limit, 10);
  const limitClause = buildSqlLimitClause(safeLimit, 10, 50);
  const [rows] = await pool.execute(
    `
      SELECT
        COALESCE(a.id, 0) AS articleId,
        COALESCE(a.slug, oi.article_slug_snapshot) AS slug,
        MAX(oi.article_title_snapshot) AS title,
        MAX(COALESCE(cat.name, oi.category_name_snapshot)) AS categoryName,
        MAX(COALESCE(b.name, oi.brand_name_snapshot)) AS brandName,
        MAX(COALESCE(a.size_text, s.code, oi.size_snapshot)) AS sizeLabel,
        SUM(oi.quantity) AS quantitySold,
        SUM(oi.line_total_snapshot) AS revenue,
        SUM(${ORDER_ITEM_BANK_TAX_EXPR}) AS bankTax,
        SUM(${ORDER_ITEM_TOTAL_COST_EXPR}) AS totalCost,
        SUM(${ORDER_ITEM_PROFIT_EXPR}) AS estimatedProfit,
        SUM(${ORDER_ITEM_INCOMPLETE_COST_EXPR}) AS incompleteCostRows,
        MAX((
          SELECT COALESCE(ai.thumb_file_path, ai.card_file_path, ai.file_path)
          FROM article_images ai
          WHERE ai.article_id = a.id
          ORDER BY ai.is_primary DESC, ai.sort_order ASC, ai.id ASC
          LIMIT 1
        )) AS image
      FROM orders o
      INNER JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN articles a ON a.id = oi.article_id
      LEFT JOIN categories cat ON cat.id = a.category_id
      LEFT JOIN brands b ON b.id = a.brand_id
      LEFT JOIN sizes s ON s.id = a.size_id
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN potential_customers pc ON pc.id = o.potential_customer_id
      ${where}
      GROUP BY COALESCE(a.id, 0), COALESCE(a.slug, oi.article_slug_snapshot)
      ORDER BY quantitySold DESC, revenue DESC, articleId DESC
      ${limitClause}
    `,
    params,
  );

  return rows.map((row) => ({
    articleId: Number(row.articleId || 0) || null,
    slug: row.slug || null,
    title: row.title,
    categoryName: row.categoryName || null,
    brandName: row.brandName || null,
    sizeLabel: row.sizeLabel || null,
    quantitySold: Number(row.quantitySold || 0),
    revenue: Number(row.revenue || 0),
    bankTax: Number(row.bankTax || 0),
    totalCost: Number(row.totalCost || 0),
    estimatedProfit: Number(row.estimatedProfit || 0),
    totalPerArticle: Number(row.revenue || 0),
    incompleteCostRows: Number(row.incompleteCostRows || 0),
    image: row.image || '',
  }));
}

export async function getStatisticsTopCustomers(filters = {}, limit = 10) {
  const { where, params } = buildCompletedOrderFilters(filters);
  const safeLimit = normalizePositiveInt(limit, 10);
  const limitClause = buildSqlLimitClause(safeLimit, 10, 50);
  const [rows] = await pool.execute(
    `
      SELECT
        COALESCE(c.id, 0) AS customerId,
        COALESCE(pc.id, 0) AS potentialCustomerId,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), ''), NULLIF(TRIM(CONCAT_WS(' ', pc.first_name, pc.last_name)), ''), 'Cliente sin nombre') AS customerName,
        COALESCE(c.email, pc.email) AS email,
        COALESCE(c.phone, pc.phone) AS phone,
        COUNT(DISTINCT o.id) AS ordersCount,
        COALESCE(SUM(oi.quantity), 0) AS itemsCount,
        COALESCE(SUM(oi.line_total_snapshot), 0) AS totalSpent,
        COALESCE(SUM(${ORDER_ITEM_BANK_TAX_EXPR}), 0) AS bankTax,
        COALESCE(SUM(${ORDER_ITEM_TOTAL_COST_EXPR}), 0) AS totalCost,
        COALESCE(SUM(${ORDER_ITEM_PROFIT_EXPR}), 0) AS estimatedProfit
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN potential_customers pc ON pc.id = o.potential_customer_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN articles a ON a.id = oi.article_id
      ${where}
      GROUP BY customerId, potentialCustomerId, customerName, email, phone
      ORDER BY totalSpent DESC, ordersCount DESC
      ${limitClause}
    `,
    params,
  );

  return rows.map((row) => ({
    customerId: Number(row.customerId || 0) || null,
    potentialCustomerId: Number(row.potentialCustomerId || 0) || null,
    customerName: row.customerName,
    email: row.email || null,
    phone: row.phone || null,
    ordersCount: Number(row.ordersCount || 0),
    itemsCount: Number(row.itemsCount || 0),
    totalSpent: Number(row.totalSpent || 0),
    bankTax: Number(row.bankTax || 0),
    totalCost: Number(row.totalCost || 0),
    estimatedProfit: Number(row.estimatedProfit || 0),
    totalOrder: Number(row.totalSpent || 0),
  }));
}

export async function getStatisticsTopCategories(filters = {}, limit = 10) {
  const { where, params } = buildSalesItemFilters(filters);
  const safeLimit = normalizePositiveInt(limit, 10);
  const limitClause = buildSqlLimitClause(safeLimit, 10, 50);
  const [rows] = await pool.execute(
    `
      SELECT
        COALESCE(cat.id, 0) AS categoryId,
        COALESCE(cat.name, oi.category_name_snapshot, 'Sin categoria') AS categoryName,
        SUM(oi.quantity) AS quantitySold,
        SUM(oi.line_total_snapshot) AS revenue,
        SUM(${ORDER_ITEM_BANK_TAX_EXPR}) AS bankTax,
        SUM(${ORDER_ITEM_TOTAL_COST_EXPR}) AS totalCost,
        SUM(${ORDER_ITEM_PROFIT_EXPR}) AS estimatedProfit
      FROM orders o
      INNER JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN articles a ON a.id = oi.article_id
      LEFT JOIN categories cat ON cat.id = a.category_id
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN potential_customers pc ON pc.id = o.potential_customer_id
      ${where}
      GROUP BY categoryId, categoryName
      ORDER BY quantitySold DESC, revenue DESC
      ${limitClause}
    `,
    params,
  );

  return rows.map((row) => ({
    categoryId: Number(row.categoryId || 0) || null,
    categoryName: row.categoryName,
    quantitySold: Number(row.quantitySold || 0),
    revenue: Number(row.revenue || 0),
    bankTax: Number(row.bankTax || 0),
    totalCost: Number(row.totalCost || 0),
    estimatedProfit: Number(row.estimatedProfit || 0),
    total: Number(row.revenue || 0),
  }));
}

export async function getStatisticsSalesOverTime(filters = {}) {
  const groupBy = filters.groupBy || 'month';
  const { where, params } = buildSalesItemFilters(filters);

  const groupExpr = groupBy === 'day'
    ? `DATE_FORMAT(COALESCE(o.approved_at, o.shipped_at, o.created_at), '%Y-%m-%d')`
    : groupBy === 'week'
      ? `DATE_FORMAT(COALESCE(o.approved_at, o.shipped_at, o.created_at), '%x-W%v')`
      : groupBy === 'year'
        ? `DATE_FORMAT(COALESCE(o.approved_at, o.shipped_at, o.created_at), '%Y')`
        : `DATE_FORMAT(COALESCE(o.approved_at, o.shipped_at, o.created_at), '%Y-%m')`;

  const [rows] = await pool.execute(
    `
      SELECT
        ${groupExpr} AS periodLabel,
        COUNT(DISTINCT o.id) AS ordersCount,
        SUM(oi.quantity) AS itemsSold,
        SUM(oi.line_total_snapshot) AS revenue,
        SUM(${ORDER_ITEM_BANK_TAX_EXPR}) AS bankTax,
        SUM(${ORDER_ITEM_TOTAL_COST_EXPR}) AS totalCost,
        SUM(${ORDER_ITEM_PROFIT_EXPR}) AS estimatedProfit
      FROM orders o
      INNER JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN articles a ON a.id = oi.article_id
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN potential_customers pc ON pc.id = o.potential_customer_id
      ${where}
      GROUP BY periodLabel
      ORDER BY MIN(COALESCE(o.approved_at, o.shipped_at, o.created_at)) ASC
    `,
    params,
  );

  return rows.map((row) => ({
    periodLabel: row.periodLabel,
    ordersCount: Number(row.ordersCount || 0),
    itemsSold: Number(row.itemsSold || 0),
    revenue: Number(row.revenue || 0),
    bankTax: Number(row.bankTax || 0),
    totalCost: Number(row.totalCost || 0),
    estimatedProfit: Number(row.estimatedProfit || 0),
    averageMargin: Number(row.revenue || 0)
      ? Number(((Number(row.estimatedProfit || 0) / Number(row.revenue || 0)) * 100).toFixed(2))
      : 0,
    total: Number(row.revenue || 0),
  }));
}

async function getWishlistConversion(filters = {}) {
  const params = [];
  const clauses = [];

  appendDateRangeFilters('wi.created_at', filters, clauses, params);

  if (filters.categoryId) {
    clauses.push('a.category_id = ?');
    params.push(filters.categoryId);
  }

  if (filters.brandId) {
    clauses.push('a.brand_id = ?');
    params.push(filters.brandId);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const [rows] = await pool.execute(
    `
      SELECT
        COUNT(*) AS totalWishlistItems,
        SUM(
          CASE
            WHEN (
              (w.customer_id IS NOT NULL OR w.potential_customer_id IS NOT NULL)
              AND EXISTS (
                SELECT 1
                FROM orders o
                INNER JOIN order_items oi ON oi.order_id = o.id
                WHERE oi.article_id = wi.article_id
                  AND o.order_status IN ('APPROVED', 'SHIPPED')
                  AND (
                    (w.customer_id IS NOT NULL AND o.customer_id = w.customer_id)
                    OR (w.potential_customer_id IS NOT NULL AND o.potential_customer_id = w.potential_customer_id)
                  )
              )
            ) THEN 1
            ELSE 0
          END
        ) AS convertedWishlistItems
      FROM wishlist_items wi
      INNER JOIN wishlists w ON w.id = wi.wishlist_id
      INNER JOIN articles a ON a.id = wi.article_id
      ${where}
    `,
    params,
  );

  const total = Number(rows[0]?.totalWishlistItems || 0);
  const converted = Number(rows[0]?.convertedWishlistItems || 0);
  return {
    totalWishlistItems: total,
    convertedWishlistItems: converted,
    conversionRate: total ? Number(((converted / total) * 100).toFixed(2)) : 0,
  };
}

export async function getStatisticsWishlist(filters = {}) {
  const wishlistFilters = buildWishlistFiltersForStats(filters);
  const summary = await getAdminWishlistSummary(wishlistFilters);
  const topArticles = await getAdminWishlistTopArticles(wishlistFilters, 10);
  const topUsers = await getAdminWishlistTopUsers(wishlistFilters, 10);
  const conversion = await getWishlistConversion(filters);

  const [categoryRows] = await pool.execute(
    `
      SELECT
        cat.name AS categoryName,
        COUNT(*) AS savesCount
      FROM wishlist_items wi
      INNER JOIN articles a ON a.id = wi.article_id
      INNER JOIN categories cat ON cat.id = a.category_id
      WHERE (? IS NULL OR a.category_id = ?)
        AND (? IS NULL OR a.brand_id = ?)
      GROUP BY cat.name
      ORDER BY savesCount DESC, cat.name ASC
      LIMIT 10
    `,
    [filters.categoryId || null, filters.categoryId || null, filters.brandId || null, filters.brandId || null],
  );

  return {
    summary: {
      ...summary,
      conversionRate: conversion.conversionRate,
      convertedWishlistItems: conversion.convertedWishlistItems,
      totalWishlistItems: conversion.totalWishlistItems,
    },
    topArticles,
    topUsers,
    topCategories: categoryRows.map((row) => ({
      categoryName: row.categoryName,
      savesCount: Number(row.savesCount || 0),
    })),
  };
}

async function getDemandByDimension(filters, { labelExpr, joinSql, extraWhere = '' }) {
  const articleClauses = [];
  const articleParams = [];

  if (filters.categoryId) {
    articleClauses.push('a.category_id = ?');
    articleParams.push(filters.categoryId);
  }

  if (filters.brandId) {
    articleClauses.push('a.brand_id = ?');
    articleParams.push(filters.brandId);
  }

  if (extraWhere) {
    articleClauses.push(extraWhere);
  }

  const articleWhere = articleClauses.length ? `WHERE ${articleClauses.join(' AND ')}` : '';
  const viewClauses = [...articleClauses];
  const viewParams = [...articleParams];
  const saveClauses = [...articleClauses];
  const saveParams = [...articleParams];
  appendDateRangeFilters('ae.created_at', filters, viewClauses, viewParams);
  appendDateRangeFilters('wi.created_at', filters, saveClauses, saveParams);

  const salesFilters = buildSalesItemFilters(filters);

  const [viewRows, saveRows, soldRows] = await Promise.all([
    pool.execute(
      `
        SELECT
          ${labelExpr} AS label,
          COUNT(*) AS total
        FROM article_events ae
        INNER JOIN articles a ON a.id = ae.article_id
        ${joinSql}
        WHERE ae.event_type = 'VIEW'${viewClauses.length ? ` AND ${viewClauses.join(' AND ')}` : ''}
        GROUP BY label
      `,
      viewParams,
    ),
    pool.execute(
      `
        SELECT
          ${labelExpr} AS label,
          COUNT(*) AS total
        FROM wishlist_items wi
        INNER JOIN articles a ON a.id = wi.article_id
        ${joinSql}
        ${saveClauses.length ? `WHERE ${saveClauses.join(' AND ')}` : ''}
        GROUP BY label
      `,
      saveParams,
    ),
    pool.execute(
      `
        SELECT
          ${labelExpr} AS label,
          SUM(oi.quantity) AS total
        FROM orders o
        INNER JOIN order_items oi ON oi.order_id = o.id
        INNER JOIN articles a ON a.id = oi.article_id
        LEFT JOIN customers c ON c.id = o.customer_id
        LEFT JOIN potential_customers pc ON pc.id = o.potential_customer_id
        ${joinSql}
        ${salesFilters.where}
        GROUP BY label
      `,
      salesFilters.params,
    ),
  ]);

  const metricMap = new Map();

  for (const row of viewRows[0]) {
    metricMap.set(row.label, { label: row.label, viewsCount: Number(row.total || 0), savesCount: 0, soldCount: 0 });
  }

  for (const row of saveRows[0]) {
    const current = metricMap.get(row.label) || { label: row.label, viewsCount: 0, savesCount: 0, soldCount: 0 };
    current.savesCount = Number(row.total || 0);
    metricMap.set(row.label, current);
  }

  for (const row of soldRows[0]) {
    const current = metricMap.get(row.label) || { label: row.label, viewsCount: 0, savesCount: 0, soldCount: 0 };
    current.soldCount = Number(row.total || 0);
    metricMap.set(row.label, current);
  }

  return [...metricMap.values()]
    .filter((row) => row.label)
    .sort((left, right) => (
      right.soldCount - left.soldCount
      || right.savesCount - left.savesCount
      || right.viewsCount - left.viewsCount
    ))
    .slice(0, 10);
}

export async function getStatisticsMarketStudy(filters = {}) {
  const categoryDemand = await getDemandByDimension(filters, {
    labelExpr: 'cat.name',
    joinSql: 'LEFT JOIN categories cat ON cat.id = a.category_id',
  });
  const brandDemand = await getDemandByDimension(filters, {
    labelExpr: 'b.name',
    joinSql: 'LEFT JOIN brands b ON b.id = a.brand_id',
  });
  const sizeDemand = await getDemandByDimension(filters, {
    labelExpr: `COALESCE(a.size_text, s.code)`,
    joinSql: 'LEFT JOIN sizes s ON s.id = a.size_id',
  });

  const [colorSaveRows, colorSoldRows, materialSaveRows, materialSoldRows] = await Promise.all([
    pool.execute(
      `
        SELECT a.color AS label, COUNT(*) AS total
        FROM wishlist_items wi
        INNER JOIN articles a ON a.id = wi.article_id
        WHERE a.color IS NOT NULL AND a.color <> ''
        GROUP BY a.color
      `,
    ),
    pool.execute(
      `
        SELECT a.color AS label, SUM(oi.quantity) AS total
        FROM orders o
        INNER JOIN order_items oi ON oi.order_id = o.id
        INNER JOIN articles a ON a.id = oi.article_id
        WHERE o.order_status IN ('APPROVED', 'SHIPPED')
          AND a.color IS NOT NULL
          AND a.color <> ''
        GROUP BY a.color
      `,
    ),
    pool.execute(
      `
        SELECT a.material AS label, COUNT(*) AS total
        FROM wishlist_items wi
        INNER JOIN articles a ON a.id = wi.article_id
        WHERE a.material IS NOT NULL AND a.material <> ''
        GROUP BY a.material
      `,
    ),
    pool.execute(
      `
        SELECT a.material AS label, SUM(oi.quantity) AS total
        FROM orders o
        INNER JOIN order_items oi ON oi.order_id = o.id
        INNER JOIN articles a ON a.id = oi.article_id
        WHERE o.order_status IN ('APPROVED', 'SHIPPED')
          AND a.material IS NOT NULL
          AND a.material <> ''
        GROUP BY a.material
      `,
    ),
  ]);

  const buildAttributeDemand = (saveRows, soldRows) => {
    const map = new Map();
    saveRows[0].forEach((row) => {
      map.set(row.label, { label: row.label, savesCount: Number(row.total || 0), soldCount: 0 });
    });
    soldRows[0].forEach((row) => {
      const current = map.get(row.label) || { label: row.label, savesCount: 0, soldCount: 0 };
      current.soldCount = Number(row.total || 0);
      map.set(row.label, current);
    });
    return [...map.values()]
      .sort((left, right) => right.soldCount - left.soldCount || right.savesCount - left.savesCount)
      .slice(0, 10);
  };

  const [highInterestRows] = await pool.execute(
    `
      SELECT
        a.id AS articleId,
        a.slug,
        a.title,
        (
          SELECT COUNT(*)
          FROM article_events ae
          WHERE ae.article_id = a.id
            AND ae.event_type = 'VIEW'
        ) AS viewsCount,
        (
          SELECT COUNT(*)
          FROM wishlist_items wi
          WHERE wi.article_id = a.id
        ) AS savesCount,
        (
          SELECT COUNT(*)
          FROM offers off
          WHERE off.article_id = a.id
        ) AS offersCount,
        (
          SELECT COALESCE(SUM(oi.quantity), 0)
          FROM order_items oi
          INNER JOIN orders o ON o.id = oi.order_id
          WHERE oi.article_id = a.id
            AND o.order_status IN ('APPROVED', 'SHIPPED')
        ) AS soldCount
      FROM articles a
      WHERE a.status = 'ACTIVE'
      HAVING soldCount = 0 AND (viewsCount > 0 OR savesCount > 0 OR offersCount > 0)
      ORDER BY savesCount DESC, viewsCount DESC, offersCount DESC
      LIMIT 10
    `,
  );

  const [lowRotationRows] = await pool.execute(
    `
      SELECT
        a.id AS articleId,
        a.slug,
        a.title,
        a.intake_date AS intakeDate,
        DATEDIFF(CURDATE(), a.intake_date) AS daysPublished,
        (
          SELECT COUNT(*)
          FROM article_events ae
          WHERE ae.article_id = a.id
            AND ae.event_type = 'VIEW'
        ) AS viewsCount,
        (
          SELECT COUNT(*)
          FROM wishlist_items wi
          WHERE wi.article_id = a.id
        ) AS savesCount,
        (
          SELECT COUNT(*)
          FROM order_items oi
          INNER JOIN orders o ON o.id = oi.order_id
          WHERE oi.article_id = a.id
            AND o.order_status IN ('APPROVED', 'SHIPPED')
        ) AS soldRows
      FROM articles a
      WHERE a.status = 'ACTIVE'
      HAVING daysPublished >= 30 AND viewsCount <= 5 AND savesCount <= 2 AND soldRows = 0
      ORDER BY daysPublished DESC, viewsCount ASC, savesCount ASC
      LIMIT 10
    `,
  );

  const [soldOutDemandRows] = await pool.execute(
    `
      SELECT
        a.id AS articleId,
        a.slug,
        a.title,
        COUNT(DISTINCT wi.id) AS savesCount,
        COUNT(DISTINCT aia.id) AS alertsCount
      FROM articles a
      INNER JOIN article_inventory inv ON inv.article_id = a.id
      LEFT JOIN wishlist_items wi ON wi.article_id = a.id
      LEFT JOIN article_interest_alerts aia ON aia.article_id = a.id AND aia.status = 'ACTIVE'
      WHERE a.status = 'ACTIVE'
        AND COALESCE(inv.quantity_available, 0) <= 0
      GROUP BY a.id, a.slug, a.title
      HAVING savesCount > 0 OR alertsCount > 0
      ORDER BY savesCount DESC, alertsCount DESC, a.id DESC
      LIMIT 10
    `,
  );

  const [offersRows] = await pool.execute(
    `
      SELECT
        COUNT(*) AS totalOffers,
        SUM(CASE WHEN off.status = 'ACCEPTED' THEN 1 ELSE 0 END) AS acceptedOffers,
        SUM(CASE WHEN off.status = 'REJECTED' THEN 1 ELSE 0 END) AS rejectedOffers,
        AVG(CASE WHEN a.sale_price > 0 THEN ((a.sale_price - off.offered_price) / a.sale_price) * 100 ELSE NULL END) AS averageRequestedDiscount
      FROM offers off
      LEFT JOIN articles a ON a.id = off.article_id
    `,
  );

  const completedFilters = buildCompletedOrderFilters(filters);
  const [paymentRows] = await pool.execute(
    `
      SELECT
        o.payment_method AS paymentMethod,
        COALESCE(o.shipping_method_description_snapshot, sm.description) AS shippingMethodName,
        COUNT(*) AS ordersCount,
        SUM(o.total_snapshot) AS revenue
      FROM orders o
      LEFT JOIN shipping_methods sm ON sm.id = o.shipping_method_id
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN potential_customers pc ON pc.id = o.potential_customer_id
      ${completedFilters.where}
      GROUP BY o.payment_method, shippingMethodName
      ORDER BY ordersCount DESC, revenue DESC
      LIMIT 12
    `,
    completedFilters.params,
  );

  return {
    categoryDemand,
    brandDemand,
    sizeDemand,
    colors: buildAttributeDemand(colorSaveRows, colorSoldRows),
    materials: buildAttributeDemand(materialSaveRows, materialSoldRows),
    highInterestLowConversion: highInterestRows.map((row) => ({
      articleId: Number(row.articleId),
      slug: row.slug,
      title: row.title,
      viewsCount: Number(row.viewsCount || 0),
      savesCount: Number(row.savesCount || 0),
      offersCount: Number(row.offersCount || 0),
      soldCount: Number(row.soldCount || 0),
    })),
    lowRotation: lowRotationRows.map((row) => ({
      articleId: Number(row.articleId),
      slug: row.slug,
      title: row.title,
      intakeDate: row.intakeDate,
      daysPublished: Number(row.daysPublished || 0),
      viewsCount: Number(row.viewsCount || 0),
      savesCount: Number(row.savesCount || 0),
    })),
    soldOutWithDemand: soldOutDemandRows.map((row) => ({
      articleId: Number(row.articleId),
      slug: row.slug,
      title: row.title,
      savesCount: Number(row.savesCount || 0),
      alertsCount: Number(row.alertsCount || 0),
    })),
    offers: {
      totalOffers: Number(offersRows[0]?.totalOffers || 0),
      acceptedOffers: Number(offersRows[0]?.acceptedOffers || 0),
      rejectedOffers: Number(offersRows[0]?.rejectedOffers || 0),
      averageRequestedDiscount: Number(offersRows[0]?.averageRequestedDiscount || 0),
    },
    paymentShipping: paymentRows.map((row) => ({
      paymentMethod: row.paymentMethod,
      shippingMethodName: row.shippingMethodName || 'Sin envío',
      ordersCount: Number(row.ordersCount || 0),
      revenue: Number(row.revenue || 0),
    })),
  };
}

export async function getStatisticsProfit(filters = {}) {
  const orderTotals = await getOrderTotals(filters);
  const salesTotals = await getSalesItemTotals(filters);
  const topArticles = await getStatisticsTopArticles(filters, 10);

  const grossRevenue = Number(orderTotals.grossRevenue || 0);
  const bankTax = Number(salesTotals.bankTax || 0);
  const totalCost = Number(salesTotals.totalCost || 0);
  const estimatedProfit = Number(salesTotals.estimatedProfit || 0);
  const averageMargin = grossRevenue ? Number(((estimatedProfit / grossRevenue) * 100).toFixed(2)) : 0;

  return {
    grossRevenue,
    bankTax,
    totalCost,
    estimatedProfit,
    averageMargin,
    incompleteCostRows: Number(salesTotals.incompleteCostRows || 0),
    topProfitableArticles: [...topArticles].sort((a, b) => b.estimatedProfit - a.estimatedProfit).slice(0, 10),
  };
}

export async function getStatisticsSummary(filters = {}) {
  const [orderTotals, salesTotals, topCustomers, topArticles, topCategories, wishlistStats] = await Promise.all([
    getOrderTotals(filters),
    getSalesItemTotals(filters),
    getStatisticsTopCustomers(filters, 1),
    getStatisticsTopArticles(filters, 1),
    getStatisticsTopCategories(filters, 1),
    getStatisticsWishlist(filters),
  ]);

  const totalOrders = Number(orderTotals.totalOrders || 0);
  const grossRevenue = Number(orderTotals.grossRevenue || 0);
  const bankTax = Number(salesTotals.bankTax || 0);
  const totalCost = Number(salesTotals.totalCost || 0);
  const estimatedProfit = Number(salesTotals.estimatedProfit || 0);
  const averageMargin = grossRevenue ? Number(((estimatedProfit / grossRevenue) * 100).toFixed(2)) : 0;

  return {
    totalOrders,
    grossRevenue,
    bankTax,
    totalCost,
    estimatedProfit,
    averageMargin,
    itemsSold: Number(salesTotals.itemsSold || 0),
    averageTicket: Number(orderTotals.averageTicket || 0),
    topCustomer: topCustomers[0] || null,
    topArticle: topArticles[0] || null,
    topCategory: topCategories[0] || null,
    topWishlistArticle: wishlistStats.summary.topArticle || null,
    wishlistConversionRate: wishlistStats.summary.conversionRate || 0,
    incompleteCostRows: Number(salesTotals.incompleteCostRows || 0),
  };
}

const HEADER_LABELS = {
  articleId: 'ID artículo',
  id: 'ID',
  slug: 'Slug',
  title: 'Artículo',
  categoryName: 'Categoría',
  brandName: 'Marca',
  sizeLabel: 'Talle',
  quantitySold: 'Cantidad vendida',
  quantityAvailable: 'Stock disponible',
  revenue: 'Ingresos',
  salePrice: 'Precio venta',
  discountedPrice: 'Precio efectivo',
  bankTax: 'Impuestos bancarios',
  totalCost: 'Costo total',
  estimatedProfit: 'Ganancia neta',
  totalPerArticle: 'Total por artículo',
  incompleteCostRows: 'Costos incompletos',
  customerId: 'ID cliente',
  potentialCustomerId: 'ID potencial',
  customerName: 'Cliente',
  name: 'Nombre',
  email: 'Email',
  phone: 'Teléfono',
  instagram: 'Instagram',
  sessionToken: 'Sesión',
  ordersCount: 'Órdenes',
  itemsCount: 'Artículos',
  totalSpent: 'Total gastado',
  totalOrder: 'Total orden',
  categoryId: 'ID categoría',
  periodLabel: 'Período',
  itemsSold: 'Artículos vendidos',
  averageMargin: 'Margen %',
  grossRevenue: 'Ingresos brutos',
  averageTicket: 'Ticket promedio',
  totalOrders: 'Órdenes totales',
  topCustomer: 'Cliente principal',
  topArticle: 'Artículo principal',
  topCategory: 'Categoría principal',
  topWishlistArticle: 'Artículo más guardado',
  wishlistConversionRate: 'Conversión guardados %',
  total: 'Total',
  summary: 'Resumen',
  totalWishlists: 'Listas',
  totalItems: 'Artículos guardados',
  totalSavedItems: 'Artículos guardados',
  totalOwners: 'Usuarios/listas únicos',
  averageItemsPerWishlist: 'Promedio de artículos por lista',
  totalWishlistItems: 'Artículos guardados',
  convertedWishlistItems: 'Guardados convertidos',
  conversionRate: 'Conversión %',
  savesCount: 'Guardados',
  usersCount: 'Usuarios',
  label: 'Detalle',
  viewsCount: 'Vistas',
  soldCount: 'Vendidos',
  offersCount: 'Ofertas',
  alertsCount: 'Alertas',
  intakeDate: 'Fecha ingreso',
  daysPublished: 'Días publicados',
  lastActivity: 'Última actividad',
  createdAt: 'Fecha creación',
  updatedAt: 'Fecha actualización',
  ownerName: 'Usuario',
  source: 'Origen',
  itemCount: 'Cantidad',
  lastSavedAt: 'Último guardado',
  savedTitlesPreview: 'Artículos guardados',
  lastArticleTitle: 'Último artículo',
  articleTitle: 'Artículo',
  articleSlug: 'Slug artículo',
  eventType: 'Evento',
  status: 'Estado',
  publicationStatus: 'Estado publicación',
  image: 'Imagen',
  paymentMethod: 'Método de pago',
  shippingMethodName: 'Método de envío',
  totalOffers: 'Ofertas totales',
  acceptedOffers: 'Ofertas aceptadas',
  rejectedOffers: 'Ofertas rechazadas',
  averageRequestedDiscount: 'Descuento promedio solicitado %',
  estado: 'Estado',
};

const MONEY_KEYS = new Set([
  'revenue',
  'bankTax',
  'totalCost',
  'estimatedProfit',
  'totalPerArticle',
  'totalSpent',
  'totalOrder',
  'grossRevenue',
  'averageTicket',
  'total',
  'salePrice',
  'discountedPrice',
]);

const PERCENT_KEYS = new Set([
  'averageMargin',
  'wishlistConversionRate',
  'conversionRate',
  'averageRequestedDiscount',
]);

const TOTALABLE_KEYS = new Set([
  'quantitySold',
  'ordersCount',
  'itemsCount',
  'itemsSold',
  'revenue',
  'bankTax',
  'totalCost',
  'estimatedProfit',
  'totalPerArticle',
  'totalSpent',
  'totalOrder',
  'grossRevenue',
  'totalOrders',
  'total',
  'totalWishlists',
  'totalItems',
  'totalWishlistItems',
  'totalSavedItems',
  'totalOwners',
  'convertedWishlistItems',
  'savesCount',
  'usersCount',
  'itemCount',
  'viewsCount',
  'soldCount',
  'offersCount',
  'alertsCount',
  'totalOffers',
  'acceptedOffers',
  'rejectedOffers',
  'incompleteCostRows',
]);

const LIST_COLUMNS = {
  summary: [
    'totalOrders',
    'grossRevenue',
    'bankTax',
    'totalCost',
    'estimatedProfit',
    'averageMargin',
    'itemsSold',
    'averageTicket',
    'topCustomer',
    'topArticle',
    'topCategory',
    'topWishlistArticle',
    'wishlistConversionRate',
    'incompleteCostRows',
  ],
  sales: [
    'periodLabel',
    'ordersCount',
    'itemsSold',
    'revenue',
    'bankTax',
    'totalCost',
    'estimatedProfit',
    'averageMargin',
    'total',
  ],
  profit: [
    'grossRevenue',
    'bankTax',
    'totalCost',
    'estimatedProfit',
    'averageMargin',
    'incompleteCostRows',
  ],
  topArticlesSales: [
    'articleId',
    'slug',
    'title',
    'categoryName',
    'brandName',
    'sizeLabel',
    'quantitySold',
    'revenue',
    'bankTax',
    'totalCost',
    'estimatedProfit',
    'incompleteCostRows',
    'totalPerArticle',
  ],
  topArticlesProfit: [
    'articleId',
    'slug',
    'title',
    'categoryName',
    'brandName',
    'sizeLabel',
    'quantitySold',
    'revenue',
    'bankTax',
    'totalCost',
    'incompleteCostRows',
    'estimatedProfit',
  ],
  topCustomers: [
    'customerName',
    'email',
    'phone',
    'ordersCount',
    'itemsCount',
    'totalSpent',
    'bankTax',
    'totalCost',
    'estimatedProfit',
    'totalOrder',
  ],
  topCategories: [
    'categoryName',
    'quantitySold',
    'revenue',
    'bankTax',
    'totalCost',
    'estimatedProfit',
    'total',
  ],
};

function collectExportColumns(rows, preferredColumns = null) {
  if (Array.isArray(preferredColumns) && preferredColumns.length) return preferredColumns;

  const columns = [];
  const seen = new Set();
  for (const row of rows || []) {
    for (const key of Object.keys(row || {})) {
      if (seen.has(key)) continue;
      seen.add(key);
      columns.push(key);
    }
  }
  return columns.length ? columns : ['estado'];
}

function getExportLabel(key) {
  return HEADER_LABELS[key] || String(key)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function normalizeExportValue(key, value) {
  if (value == null) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.join(' | ');
  if (typeof value === 'object') {
    return value.customerName
      || value.title
      || value.categoryName
      || value.brandName
      || value.label
      || '';
  }
  if (PERCENT_KEYS.has(key) && typeof value === 'number') {
    return value / 100;
  }
  return value;
}

function getWeightedMargin(rows) {
  const totalProfit = rows.reduce((sum, row) => sum + Number(row.estimatedProfit || 0), 0);
  const totalRevenue = rows.reduce(
    (sum, row) => sum + Number(row.revenue || row.totalSpent || row.grossRevenue || row.total || 0),
    0,
  );
  return totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
}

function buildTotalsRow(rows, columns) {
  const totals = {};
  const firstColumn = columns[0] || 'estado';
  totals[firstColumn] = 'Totales';

  for (const column of columns.slice(1)) {
    if (column === 'averageMargin') {
      totals[column] = getWeightedMargin(rows);
      continue;
    }

    if (!TOTALABLE_KEYS.has(column)) {
      totals[column] = '';
      continue;
    }

    totals[column] = rows.reduce((sum, row) => sum + Number(row?.[column] || 0), 0);
  }

  return totals;
}

function appendSheet(workbook, name, rows, options = {}) {
  const safeRows = Array.isArray(rows) && rows.length ? rows : [{ estado: 'Sin datos' }];
  const columns = collectExportColumns(safeRows, options.columns);
  const worksheet = workbook.addWorksheet(String(name || 'Hoja').slice(0, 31));

  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.addRow(columns.map(getExportLabel));

  for (const row of safeRows) {
    worksheet.addRow(columns.map((column) => normalizeExportValue(column, row?.[column])));
  }

  if (options.includeTotals !== false && safeRows.length && !safeRows[0].estado) {
    const totalsRow = buildTotalsRow(safeRows, columns);
    worksheet.addRow(columns.map((column) => normalizeExportValue(column, totalsRow[column])));
  }

  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF08265A' },
  };
  worksheet.getRow(1).alignment = { vertical: 'middle' };

  const lastRow = worksheet.getRow(worksheet.rowCount);
  if (worksheet.rowCount > safeRows.length + 1) {
    lastRow.font = { bold: true };
    lastRow.border = { top: { style: 'thin', color: { argb: 'FF08265A' } } };
    lastRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF4ED' },
    };
  }

  worksheet.columns = columns.map((column) => ({
    key: column,
    width: Math.max(12, Math.min(34, getExportLabel(column).length + 4)),
  }));

  columns.forEach((column, index) => {
    const excelColumn = worksheet.getColumn(index + 1);
    if (MONEY_KEYS.has(column)) {
      excelColumn.numFmt = '"$" #,##0.00;[Red]-"$" #,##0.00';
      excelColumn.alignment = { horizontal: 'right' };
    } else if (PERCENT_KEYS.has(column)) {
      excelColumn.numFmt = '0.00%';
      excelColumn.alignment = { horizontal: 'right' };
    } else if (TOTALABLE_KEYS.has(column)) {
      excelColumn.numFmt = '#,##0';
      excelColumn.alignment = { horizontal: 'right' };
    }
  });

  return worksheet;
}

export async function exportStatisticsReport(filters = {}, type = 'full') {
  const workbook = createWorkbook();

  if (type === 'summary') {
    appendSheet(workbook, 'Resumen', [await getStatisticsSummary(filters)], {
      columns: LIST_COLUMNS.summary,
      includeTotals: false,
    });
  } else if (type === 'sales') {
    appendSheet(workbook, 'Ventas por periodo', await getStatisticsSalesOverTime(filters), {
      columns: LIST_COLUMNS.sales,
    });
  } else if (type === 'profits') {
    const profit = await getStatisticsProfit(filters);
    appendSheet(workbook, 'Ganancias', [profit], {
      columns: LIST_COLUMNS.profit,
      includeTotals: false,
    });
    appendSheet(workbook, 'Top ganancia', profit.topProfitableArticles || [], {
      columns: LIST_COLUMNS.topArticlesProfit,
    });
  } else if (type === 'top_articles') {
    appendSheet(workbook, 'Prendas mas vendidas', await getStatisticsTopArticles(filters, 50), {
      columns: LIST_COLUMNS.topArticlesSales,
    });
  } else if (type === 'top_customers') {
    appendSheet(workbook, 'Top clientes', await getStatisticsTopCustomers(filters, 50), {
      columns: LIST_COLUMNS.topCustomers,
    });
  } else if (type === 'categories') {
    appendSheet(workbook, 'Categorías', await getStatisticsTopCategories(filters, 50), {
      columns: LIST_COLUMNS.topCategories,
    });
  } else if (type === 'wishlist') {
    const wishlist = await getStatisticsWishlist(filters);
    appendSheet(workbook, 'Resumen wishlist', [wishlist.summary], { includeTotals: false });
    appendSheet(workbook, 'Top guardados', wishlist.topArticles);
    appendSheet(workbook, 'Top usuarios', wishlist.topUsers);
    appendSheet(workbook, 'Categorías guardadas', wishlist.topCategories);
  } else if (type === 'market_study') {
    const market = await getStatisticsMarketStudy(filters);
    appendSheet(workbook, 'Categorías demanda', market.categoryDemand);
    appendSheet(workbook, 'Marcas demanda', market.brandDemand);
    appendSheet(workbook, 'Talles demanda', market.sizeDemand);
    appendSheet(workbook, 'Colores', market.colors);
    appendSheet(workbook, 'Materiales', market.materials);
    appendSheet(workbook, 'Alto interés', market.highInterestLowConversion);
    appendSheet(workbook, 'Baja rotación', market.lowRotation);
    appendSheet(workbook, 'Agotados demanda', market.soldOutWithDemand);
  } else {
    const [summary, sales, topArticles, topCustomers, topCategories, profit, wishlist, market] = await Promise.all([
      getStatisticsSummary(filters),
      getStatisticsSalesOverTime(filters),
      getStatisticsTopArticles(filters, 50),
      getStatisticsTopCustomers(filters, 50),
      getStatisticsTopCategories(filters, 50),
      getStatisticsProfit(filters),
      getStatisticsWishlist(filters),
      getStatisticsMarketStudy(filters),
    ]);

    appendSheet(workbook, 'Resumen', [summary], {
      columns: LIST_COLUMNS.summary,
      includeTotals: false,
    });
    appendSheet(workbook, 'Ventas por periodo', sales, {
      columns: LIST_COLUMNS.sales,
    });
    appendSheet(workbook, 'Artículos vendidos', topArticles, {
      columns: LIST_COLUMNS.topArticlesSales,
    });
    appendSheet(workbook, 'Top clientes', topCustomers, {
      columns: LIST_COLUMNS.topCustomers,
    });
    appendSheet(workbook, 'Categorías vendidas', topCategories, {
      columns: LIST_COLUMNS.topCategories,
    });
    appendSheet(workbook, 'Ganancias', [profit], {
      columns: LIST_COLUMNS.profit,
      includeTotals: false,
    });
    appendSheet(workbook, 'Top ganancia', profit.topProfitableArticles || [], {
      columns: LIST_COLUMNS.topArticlesProfit,
    });
    appendSheet(workbook, 'Wishlist resumen', [wishlist.summary], { includeTotals: false });
    appendSheet(workbook, 'Wishlist artículos', wishlist.topArticles);
    appendSheet(workbook, 'Wishlist usuarios', wishlist.topUsers);
    appendSheet(workbook, 'Interés alto', market.highInterestLowConversion);
    appendSheet(workbook, 'Baja rotación', market.lowRotation);
    appendSheet(workbook, 'Agotados demanda', market.soldOutWithDemand);
  }

  const today = new Date().toISOString().slice(0, 10);
  return {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileName: `esadar-estadisticas-${type}-${today}.xlsx`,
    payload: await workbookToXlsxBuffer(workbook),
  };
}
