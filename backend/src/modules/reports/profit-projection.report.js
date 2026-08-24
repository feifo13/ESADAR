import { deriveStockStatus } from '../inventory/inventory.constants.js';
import {
  buildArticleFinancialProjectionRows,
  buildArticleProfitProjectionSummary,
} from '../articles/article-financial-projection.js';
import { createReportProjection } from './report-projection.js';

export const PROFIT_PROJECTION_REPORT_COLUMNS = Object.freeze([
  { key: 'internalCode', header: 'Código' },
  { key: 'title', header: 'Artículo' },
  { key: 'lotCode', header: 'Código lote' },
  { key: 'lotName', header: 'Lote' },
  { key: 'categoryName', header: 'Categoría' },
  { key: 'brandName', header: 'Marca' },
  { key: 'sizeLabel', header: 'Talle' },
  { key: 'intakeDate', header: 'Fecha ingreso' },
  { key: 'publicationStatus', header: 'Estado publicación' },
  { key: 'stockStatus', header: 'Estado stock' },
  { key: 'quantityTotal', header: 'Stock total', type: 'number' },
  { key: 'quantityAvailable', header: 'Disponible', type: 'number' },
  { key: 'quantityReserved', header: 'Reservado', type: 'number' },
  { key: 'quantitySold', header: 'Vendido', type: 'number' },
  { key: 'quantityLost', header: 'Perdido', type: 'number' },
  { key: 'purchasePriceItem', header: 'Costo artículo', type: 'currency' },
  { key: 'purchasePriceShipping', header: 'Costo envío USA', type: 'currency' },
  { key: 'purchasePriceCourier', header: 'Costo courier', type: 'currency' },
  { key: 'purchasePriceTotal', header: 'Costo compra total', type: 'currency' },
  { key: 'bankTaxBase', header: 'Base impuesto bancario', type: 'currency' },
  { key: 'bankTaxPercent', header: 'Tasa bancaria %', type: 'number' },
  { key: 'bankTax', header: 'Impuesto bancario', type: 'currency' },
  { key: 'totalCost', header: 'Costo total', type: 'currency' },
  { key: 'effectiveSalePrice', header: 'Precio de venta efectivo', type: 'currency' },
  { key: 'estimatedProfit', header: 'Ganancia proyectada', type: 'currency' },
  { key: 'estimatedMargin', header: 'Margen proyectado %', type: 'number' },
  { key: 'result', header: 'Resultado' },
]);

export function buildCanonicalProfitProjection(sourceRows = [], costingSettings = {}) {
  const financialRows = buildArticleFinancialProjectionRows(sourceRows, costingSettings);
  const rows = financialRows.map((financialRow, index) => {
    const source = sourceRows[index] || {};
    return {
      ...financialRow,
      publicationStatus: source.publicationStatus || source.status || null,
      stockStatus: deriveStockStatus(source),
      quantityLost: Number(source.quantityLost || 0),
    };
  });

  return createReportProjection({
    columns: PROFIT_PROJECTION_REPORT_COLUMNS,
    rows,
    summary: buildArticleProfitProjectionSummary(financialRows),
    metadata: { reportId: 'PROFIT_PROJECTION' },
  });
}
