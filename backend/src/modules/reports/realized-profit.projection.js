import { evaluateHistoricalSaleCostIntegrity } from './cost-integrity.js';
import { createReportProjection } from './report-projection.js';
import {
  CANONICAL_COMPLETED_SALE_STATUSES,
  CANONICAL_SALE_DATE_FIELD,
  isCanonicalCompletedSaleStatus,
} from './completed-sales.js';

export {
  CANONICAL_COMPLETED_SALE_STATUSES,
  CANONICAL_SALE_DATE_FIELD,
  isCanonicalCompletedSaleStatus,
} from './completed-sales.js';

export const REALIZED_PROFIT_COLUMNS = Object.freeze([
  { key: 'orderNumber', header: 'Orden' },
  { key: 'orderStatus', header: 'Estado orden' },
  { key: 'approvedAt', header: 'Fecha aprobación' },
  { key: 'articleTitle', header: 'Artículo' },
  { key: 'lotCode', header: 'Código lote' },
  { key: 'lotName', header: 'Nombre lote' },
  { key: 'categoryName', header: 'Categoría histórica' },
  { key: 'brandName', header: 'Marca histórica' },
  { key: 'shippingMethod', header: 'Método de envío histórico' },
  { key: 'quantity', header: 'Cantidad', type: 'number' },
  { key: 'salePrice', header: 'Precio publicado histórico', type: 'currency' },
  { key: 'finalUnitPrice', header: 'Precio unitario realizado', type: 'currency' },
  { key: 'revenue', header: 'Ingreso realizado', type: 'currency' },
  { key: 'purchasePriceItem', header: 'Costo artículo histórico', type: 'currency' },
  { key: 'purchasePriceShipping', header: 'Envío USA histórico', type: 'currency' },
  { key: 'purchasePriceCourier', header: 'Envío MVD histórico', type: 'currency' },
  { key: 'purchasePriceTotal', header: 'Costo compra histórico', type: 'currency' },
  { key: 'bankTaxRate', header: 'Tasa bancaria histórica', type: 'number' },
  { key: 'bankTaxBase', header: 'Base bancaria histórica', type: 'currency' },
  { key: 'bankTax', header: 'Impuesto bancario histórico', type: 'currency' },
  { key: 'totalCost', header: 'Costo total histórico', type: 'currency' },
  { key: 'realizedProfit', header: 'Ganancia realizada', type: 'currency' },
  { key: 'realizedMargin', header: 'Margen realizado %', type: 'number' },
  { key: 'dataQuality', header: 'Calidad de datos' },
  { key: 'issueCodes', header: 'Incidencias' },
]);

function optionalNumber(value) {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return String(value);
}

export function evaluateRealizedProfitSnapshotCompleteness(row = {}) {
  const integrity = evaluateHistoricalSaleCostIntegrity(row);
  const issueCodes = [...integrity.issueCodes];
  const missingContextFields = [];

  if (!row.approvedAt) {
    missingContextFields.push('approvedAt');
    issueCodes.push('MISSING_APPROVED_DATE');
  }
  if (!Number.isInteger(Number(row.quantity)) || Number(row.quantity) <= 0) {
    missingContextFields.push('quantity');
    issueCodes.push('INVALID_QUANTITY');
  }

  return {
    dataQuality: issueCodes.length ? 'INCOMPLETE' : 'COMPLETE',
    issueCodes,
    missingFields: [...integrity.missingFields, ...missingContextFields],
  };
}

export function projectCanonicalRealizedProfitRow(row = {}) {
  const orderStatus = String(row.orderStatus || row.status || '').toUpperCase();
  if (!isCanonicalCompletedSaleStatus(orderStatus)) return null;

  const completeness = evaluateRealizedProfitSnapshotCompleteness(row);
  const isComplete = completeness.dataQuality === 'COMPLETE';
  const revenue = optionalNumber(row.lineTotalSnapshot);
  const realizedProfit = isComplete ? optionalNumber(row.profitSnapshot) : null;
  return {
    orderNumber: row.orderNumber || null,
    orderStatus,
    approvedAt: normalizeDate(row.approvedAt),
    articleTitle: row.articleTitleSnapshot || null,
    lotCode: row.lotCodeSnapshot || null,
    lotName: row.lotNameSnapshot || null,
    categoryName: row.categoryNameSnapshot || null,
    brandName: row.brandNameSnapshot || null,
    shippingMethod: row.shippingMethodDescriptionSnapshot || null,
    quantity: optionalNumber(row.quantity),
    salePrice: optionalNumber(row.salePriceSnapshot),
    finalUnitPrice: optionalNumber(row.finalUnitPriceSnapshot),
    revenue,
    purchasePriceItem: optionalNumber(row.purchasePriceItemSnapshot),
    purchasePriceShipping: optionalNumber(row.purchasePriceShippingSnapshot),
    purchasePriceCourier: optionalNumber(row.purchasePriceCourierSnapshot),
    purchasePriceTotal: optionalNumber(row.purchasePriceTotalSnapshot),
    bankTaxRate: optionalNumber(row.bankTaxRateSnapshot),
    bankTaxBase: optionalNumber(row.bankTaxBaseSnapshot),
    bankTax: optionalNumber(row.bankTaxSnapshot),
    totalCost: optionalNumber(row.totalCostSnapshot),
    realizedProfit,
    realizedMargin: isComplete && revenue > 0
      ? Number(((realizedProfit / revenue) * 100).toFixed(2))
      : null,
    dataQuality: completeness.dataQuality,
    issueCodes: completeness.issueCodes,
  };
}

export function buildCanonicalRealizedProfitProjection(sourceRows = [], options = {}) {
  const projectedRows = sourceRows
    .map(projectCanonicalRealizedProfitRow)
    .filter(Boolean);
  const rows = options.dataQuality
    ? projectedRows.filter(({ dataQuality }) => dataQuality === options.dataQuality)
    : projectedRows;
  const completeRows = rows.filter(({ dataQuality }) => dataQuality === 'COMPLETE');
  const reliableProfitTotal = Number(completeRows
    .reduce((sum, row) => sum + Number(row.realizedProfit || 0), 0)
    .toFixed(2));

  return createReportProjection({
    columns: REALIZED_PROFIT_COLUMNS,
    rows,
    summary: {
      completedSaleRowCount: rows.length,
      completeRowCount: completeRows.length,
      incompleteRowCount: rows.length - completeRows.length,
      reliableProfitTotal,
    },
    metadata: {
      reportId: 'REALIZED_PROFITS',
      saleDateField: CANONICAL_SALE_DATE_FIELD,
      allowedOrderStatuses: [...CANONICAL_COMPLETED_SALE_STATUSES],
    },
  });
}
