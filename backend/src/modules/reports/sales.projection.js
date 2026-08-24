import { createReportProjection } from './report-projection.js';
import {
  CANONICAL_COMPLETED_SALE_STATUSES,
  CANONICAL_SALE_DATE_FIELD,
  isCanonicalCompletedSaleStatus,
} from './completed-sales.js';

export const SALES_REPORT_COLUMNS = Object.freeze([
  { key: 'approvedAt', header: 'Fecha aprobación' },
  { key: 'orderNumber', header: 'Orden' },
  { key: 'orderStatus', header: 'Estado' },
  { key: 'paymentMethod', header: 'Método de pago' },
  { key: 'shippingMethod', header: 'Método de envío' },
  { key: 'articleTitle', header: 'Artículo' },
  { key: 'lotCode', header: 'Código lote' },
  { key: 'lotName', header: 'Lote' },
  { key: 'categoryName', header: 'Categoría histórica' },
  { key: 'brandName', header: 'Marca histórica' },
  { key: 'quantity', header: 'Cantidad', type: 'number' },
  { key: 'finalUnitPrice', header: 'Precio unitario final', type: 'currency' },
  { key: 'lineTotal', header: 'Total línea', type: 'currency' },
]);

const PAYMENT_METHOD_LABELS = Object.freeze({
  BANK_TRANSFER: 'Transferencia bancaria',
  MERCADO_PAGO: 'Mercado Pago',
});

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

export function projectCanonicalSaleRow(row = {}) {
  const orderStatus = String(row.orderStatus || row.status || '').toUpperCase();
  if (!isCanonicalCompletedSaleStatus(orderStatus) || !row.approvedAt) return null;
  const paymentMethodCode = String(row.paymentMethod || '').toUpperCase();

  return {
    approvedAt: normalizeDate(row.approvedAt),
    orderNumber: row.orderNumber || null,
    orderStatus,
    paymentMethod: PAYMENT_METHOD_LABELS[paymentMethodCode] || paymentMethodCode || null,
    shippingMethod: row.shippingMethodDescriptionSnapshot || null,
    articleTitle: row.articleTitleSnapshot || null,
    lotCode: row.lotCodeSnapshot || null,
    lotName: row.lotNameSnapshot || null,
    categoryName: row.categoryNameSnapshot || null,
    brandName: row.brandNameSnapshot || null,
    quantity: optionalNumber(row.quantity),
    finalUnitPrice: optionalNumber(row.finalUnitPriceSnapshot),
    lineTotal: optionalNumber(row.lineTotalSnapshot),
  };
}

export function buildCanonicalSalesProjection(sourceRows = []) {
  const rows = sourceRows.map(projectCanonicalSaleRow).filter(Boolean);
  return createReportProjection({
    columns: SALES_REPORT_COLUMNS,
    rows,
    summary: {
      saleRowCount: rows.length,
      quantityTotal: rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
      revenueTotal: Number(rows.reduce((sum, row) => sum + Number(row.lineTotal || 0), 0).toFixed(2)),
    },
    metadata: {
      reportId: 'SALES',
      saleDateField: CANONICAL_SALE_DATE_FIELD,
      allowedOrderStatuses: [...CANONICAL_COMPLETED_SALE_STATUSES],
    },
  });
}
