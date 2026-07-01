import { pool } from '../../db/pool.js';
import { appendDateRangeFilters, buildLikeValue } from '../../utils/listing.js';
import { generateArticleMarginsReportPdf } from './pdf/article-margins-report-pdf.js';
import {
  calculateArticleMargin,
  calculateTotals,
} from './statistics.margin-calculator.js';
import { getCostingSettings } from '../collecting/collecting.service.js';

const ARTICLE_STATUSES = new Set(['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED']);

export const calculateArticleMarginMetrics = calculateArticleMargin;

function buildArticleMarginsFilters(filters = {}) {
  const clauses = [];
  const params = [];

  appendDateRangeFilters('a.intake_date', filters, clauses, params);

  if (filters.categoryId) {
    clauses.push('a.category_id = ?');
    params.push(filters.categoryId);
  }

  if (filters.brandId) {
    clauses.push('a.brand_id = ?');
    params.push(filters.brandId);
  }

  if (filters.status && ARTICLE_STATUSES.has(filters.status)) {
    clauses.push('a.status = ?');
    params.push(filters.status);
  }

  if (filters.q) {
    const like = buildLikeValue(filters.q);
    clauses.push(`(
      a.title LIKE ?
      OR a.internal_code LIKE ?
      OR COALESCE(b.name, '') LIKE ?
      OR COALESCE(cat.name, '') LIKE ?
      OR COALESCE(a.size_text, s.code, '') LIKE ?
    )`);
    params.push(like, like, like, like, like);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

function normalizeArticleMarginRow(row, costingSettings) {
  const metrics = calculateArticleMarginMetrics(row, {
    bankTaxRate: costingSettings.bankTaxRate,
  });

  return {
    articleId: Number(row.articleId || 0),
    intakeDate: row.intakeDate || null,
    internalCode: row.internalCode || '',
    title: row.title || '',
    brandName: row.brandName || '',
    categoryName: row.categoryName || '',
    sizeLabel: row.sizeLabel || '',
    status: row.status || '',
    ...metrics,
  };
}

export async function getArticleMarginsReport(filters = {}) {
  const { where, params } = buildArticleMarginsFilters(filters);
  const costingSettings = await getCostingSettings();
  const [rows] = await pool.execute(
    `
      SELECT
        a.id AS articleId,
        a.intake_date AS intakeDate,
        a.internal_code AS internalCode,
        a.title,
        a.status,
        COALESCE(b.name, '') AS brandName,
        COALESCE(cat.name, '') AS categoryName,
        COALESCE(a.size_text, s.code, '') AS sizeLabel,
        a.sale_price AS salePrice,
        a.discount_type AS discountType,
        a.discount_value AS discountValue,
        a.purchase_price_item AS purchasePriceItem,
        a.purchase_price_shipping AS purchasePriceShipping,
        a.purchase_price_courier AS purchasePriceCourier
      FROM articles a
      LEFT JOIN brands b ON b.id = a.brand_id
      LEFT JOIN categories cat ON cat.id = a.category_id
      LEFT JOIN sizes s ON s.id = a.size_id
      ${where}
      ORDER BY a.intake_date DESC, a.id DESC
    `,
    params,
  );

  const items = rows.map((row) => normalizeArticleMarginRow(row, costingSettings));
  const summary = calculateTotals(items);
  summary.bankTaxPercent = costingSettings.bankTaxPercent;

  return {
    filters,
    bankTaxRate: costingSettings.bankTaxRate,
    bankTaxPercent: costingSettings.bankTaxPercent,
    generatedAt: new Date(),
    summary,
    items,
  };
}

export async function exportArticleMarginsPdf(filters = {}) {
  const report = await getArticleMarginsReport(filters);
  const today = new Date().toISOString().slice(0, 10);

  return {
    contentType: 'application/pdf',
    fileName: `esadar-margenes-articulos-${today}.pdf`,
    payload: await generateArticleMarginsReportPdf(report),
  };
}
