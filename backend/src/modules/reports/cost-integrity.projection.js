import {
  evaluateCurrentArticleCostIntegrity,
  evaluateHistoricalSaleCostIntegrity,
} from './cost-integrity.js';
import { createReportProjection } from './report-projection.js';

export const COST_INTEGRITY_SCOPES = Object.freeze({
  CURRENT_ARTICLES: 'CURRENT_ARTICLES',
  HISTORICAL_SALES: 'HISTORICAL_SALES',
  ALL: 'ALL',
});

export const COST_INTEGRITY_ISSUE_LABELS = Object.freeze({
  MISSING_ITEM_COST: 'Falta el costo base del artículo',
  MISSING_HISTORICAL_SNAPSHOT: 'Falta un snapshot histórico requerido',
  INVALID_ITEM_COST: 'El costo base del artículo no es confiable',
  INVALID_COST_COMPONENT: 'Un componente de costo es inválido',
  INVALID_BANK_TAX_SNAPSHOT: 'El snapshot de impuesto bancario es inválido',
  INVALID_SALE_PRICE: 'El precio efectivo de venta no es válido',
  CURRENT_COST_FALLBACK_FORBIDDEN: 'Se intentó usar costo actual como histórico',
  UNCOMPUTABLE_PROFIT: 'La ganancia histórica no puede calcularse',
});

export const COST_INTEGRITY_REPORT_COLUMNS = Object.freeze([
  { key: 'scope', header: 'Alcance' },
  { key: 'reference', header: 'Referencia' },
  { key: 'articleTitle', header: 'Artículo' },
  { key: 'lotCode', header: 'Código lote' },
  { key: 'categoryName', header: 'Categoría' },
  { key: 'brandName', header: 'Marca' },
  { key: 'relevantDate', header: 'Fecha relevante' },
  { key: 'itemCost', header: 'Costo base', type: 'currency' },
  { key: 'effectiveSalePrice', header: 'Precio efectivo', type: 'currency' },
  { key: 'dataQuality', header: 'Calidad de datos' },
  { key: 'issueCodes', header: 'Códigos de incidencia' },
  { key: 'issueLabels', header: 'Problemas detectados' },
]);

function optionalNumber(value) {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function labelsFor(issueCodes) {
  return issueCodes.map((code) => COST_INTEGRITY_ISSUE_LABELS[code] || code);
}

export function projectCurrentArticleCostIntegrityRow(row = {}, costingSettings = {}) {
  const integrity = evaluateCurrentArticleCostIntegrity(row, {
    bankTaxRate: costingSettings.bankTaxRate,
  });
  return {
    scope: COST_INTEGRITY_SCOPES.CURRENT_ARTICLES,
    reference: row.internalCode || null,
    articleTitle: row.title || null,
    lotCode: row.lotCode || null,
    categoryName: row.categoryName || null,
    brandName: row.brandName || null,
    relevantDate: row.intakeDate || null,
    itemCost: optionalNumber(row.purchasePriceItem),
    effectiveSalePrice: optionalNumber(row.discountedPrice ?? row.salePrice),
    dataQuality: integrity.dataQuality,
    issueCodes: integrity.issueCodes,
    issueLabels: labelsFor(integrity.issueCodes),
  };
}

export function projectHistoricalSaleCostIntegrityRow(row = {}) {
  const integrity = evaluateHistoricalSaleCostIntegrity(row);
  return {
    scope: COST_INTEGRITY_SCOPES.HISTORICAL_SALES,
    reference: row.orderNumber || null,
    articleTitle: row.articleTitleSnapshot || null,
    lotCode: row.lotCodeSnapshot || null,
    categoryName: row.categoryNameSnapshot || null,
    brandName: row.brandNameSnapshot || null,
    relevantDate: row.approvedAt || null,
    itemCost: optionalNumber(row.purchasePriceItemSnapshot),
    effectiveSalePrice: optionalNumber(row.finalUnitPriceSnapshot),
    dataQuality: integrity.dataQuality,
    issueCodes: integrity.issueCodes,
    issueLabels: labelsFor(integrity.issueCodes),
  };
}

export function buildCanonicalCostIntegrityProjection({
  currentArticles = [],
  historicalSales = [],
  costingSettings = {},
  filters = {},
} = {}) {
  const scope = filters.scope || COST_INTEGRITY_SCOPES.ALL;
  const rows = [
    ...(scope !== COST_INTEGRITY_SCOPES.HISTORICAL_SALES
      ? currentArticles.map((row) => projectCurrentArticleCostIntegrityRow(row, costingSettings))
      : []),
    ...(scope !== COST_INTEGRITY_SCOPES.CURRENT_ARTICLES
      ? historicalSales.map(projectHistoricalSaleCostIntegrityRow)
      : []),
  ].filter((row) => {
    if (filters.unreliableOnly !== false && row.dataQuality === 'COMPLETE') return false;
    if (filters.issueCode && !row.issueCodes.includes(filters.issueCode)) return false;
    return true;
  });
  const problemRowCount = rows.filter(
    ({ dataQuality }) => dataQuality === 'INCOMPLETE',
  ).length;
  const issueCount = rows.reduce(
    (count, row) => count + (Array.isArray(row.issueCodes) ? row.issueCodes.length : 0),
    0,
  );

  return createReportProjection({
    columns: COST_INTEGRITY_REPORT_COLUMNS,
    rows,
    totalRow: {
      scope: 'TOTAL',
      dataQuality: `Filas con problemas: ${problemRowCount}`,
      issueCodes: `Incidencias detectadas: ${issueCount}`,
    },
    summary: {
      rowCount: rows.length,
      incompleteRowCount: problemRowCount,
      issueCount,
      currentArticleRowCount: rows.filter(({ scope: rowScope }) => (
        rowScope === COST_INTEGRITY_SCOPES.CURRENT_ARTICLES
      )).length,
      historicalSaleRowCount: rows.filter(({ scope: rowScope }) => (
        rowScope === COST_INTEGRITY_SCOPES.HISTORICAL_SALES
      )).length,
    },
    metadata: { reportId: 'COST_INTEGRITY', scope },
  });
}
