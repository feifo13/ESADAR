import { deriveStockStatus } from '../inventory/inventory.constants.js';
import {
  calculateReportAggregatePercentage,
  createReportProjection,
  sumReportNumericField,
} from './report-projection.js';

export const ROTATION_HISTORY_SCOPES = Object.freeze({
  RECORDED_LEDGER: 'RECORDED_LEDGER',
  MIGRATED_BASELINE: 'MIGRATED_BASELINE',
  PARTIAL_HISTORY: 'PARTIAL_HISTORY',
});

export const MIGRATED_INITIAL_STOCK_REASON = 'Inventario inicial migrado desde articles';

export const CURRENT_STOCK_COLUMNS = Object.freeze([
  { key: 'internalCode', header: 'Código interno' },
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
  { key: 'quantityAvailable', header: 'Stock disponible', type: 'number' },
  { key: 'quantityReserved', header: 'Stock reservado', type: 'number' },
  { key: 'quantitySold', header: 'Stock vendido', type: 'number' },
  { key: 'quantityLost', header: 'Stock perdido', type: 'number' },
  { key: 'inventoryDataQuality', header: 'Calidad inventario' },
  { key: 'issueCodes', header: 'Incidencias' },
]);

export const STOCK_ROTATION_V1_COLUMNS = Object.freeze([
  { key: 'internalCode', header: 'Código interno' },
  { key: 'title', header: 'Artículo' },
  { key: 'lotCode', header: 'Código lote' },
  { key: 'lotName', header: 'Lote' },
  { key: 'categoryName', header: 'Categoría' },
  { key: 'brandName', header: 'Marca' },
  { key: 'publicationStatus', header: 'Estado publicación' },
  { key: 'stockStatus', header: 'Estado stock' },
  { key: 'intakeDate', header: 'Fecha ingreso' },
  { key: 'daysSinceIntake', header: 'Días desde ingreso', type: 'number' },
  { key: 'quantityTotal', header: 'Stock total', type: 'number' },
  { key: 'quantityAvailable', header: 'Stock disponible', type: 'number' },
  { key: 'quantityReserved', header: 'Stock reservado', type: 'number' },
  { key: 'quantitySold', header: 'Stock vendido neto', type: 'number' },
  { key: 'quantityLost', header: 'Stock perdido', type: 'number' },
  { key: 'netSoldPercentage', header: 'Vendido neto %', type: 'number' },
  { key: 'lastRecordedSaleAt', header: 'Última venta registrada' },
  { key: 'historyScope', header: 'Alcance histórico' },
]);

function asQuantity(value) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getInventoryBalances(row) {
  return {
    quantityTotal: asQuantity(row.quantityTotal),
    quantityAvailable: asQuantity(row.quantityAvailable),
    quantityReserved: asQuantity(row.quantityReserved),
    quantitySold: asQuantity(row.quantitySold),
    quantityLost: asQuantity(row.quantityLost),
  };
}

function hasValidBalanceValues(balances) {
  return Object.values(balances).every(
    (quantity) => Number.isInteger(quantity) && quantity >= 0,
  );
}

export function isStockInvariantValid(row = {}) {
  const balances = getInventoryBalances(row);
  return hasValidBalanceValues(balances)
    && balances.quantityTotal === balances.quantityAvailable
      + balances.quantityReserved
      + balances.quantitySold
      + balances.quantityLost;
}

export function projectCurrentStockRow(row = {}) {
  const balances = getInventoryBalances(row);
  const valid = isStockInvariantValid(balances);
  return {
    internalCode: row.internalCode || null,
    title: row.title || null,
    lotCode: row.lotCode || null,
    lotName: row.lotName || null,
    categoryName: row.categoryName || null,
    brandName: row.brandName || null,
    sizeLabel: row.sizeCode || row.sizeText || null,
    intakeDate: row.intakeDate || null,
    publicationStatus: row.publicationStatus || row.status || null,
    stockStatus: deriveStockStatus(balances),
    ...balances,
    inventoryDataQuality: valid ? 'COMPLETE' : 'INCOMPLETE',
    issueCodes: valid ? [] : ['STOCK_BALANCE_INVARIANT_VIOLATION'],
  };
}

function buildInventoryTotalRow(rows, { includeSoldPercentage = false } = {}) {
  const totalRow = {
    internalCode: 'TOTAL',
    quantityTotal: sumReportNumericField(rows, 'quantityTotal'),
    quantityAvailable: sumReportNumericField(rows, 'quantityAvailable'),
    quantityReserved: sumReportNumericField(rows, 'quantityReserved'),
    quantitySold: sumReportNumericField(rows, 'quantitySold'),
    quantityLost: sumReportNumericField(rows, 'quantityLost'),
  };
  if (includeSoldPercentage) {
    totalRow.netSoldPercentage = calculateReportAggregatePercentage(
      totalRow.quantitySold,
      totalRow.quantityTotal,
    );
  }
  return totalRow;
}

export function buildCurrentStockProjection(sourceRows = []) {
  const rows = sourceRows.map(projectCurrentStockRow);
  return createReportProjection({
    columns: CURRENT_STOCK_COLUMNS,
    rows,
    totalRow: buildInventoryTotalRow(rows),
    summary: {
      rowCount: rows.length,
      invalidBalanceRowCount: rows.filter(
        ({ inventoryDataQuality }) => inventoryDataQuality === 'INCOMPLETE',
      ).length,
    },
    metadata: { reportId: 'STOCK' },
  });
}

export function resolveRotationHistoryScope(row = {}) {
  if (row.initialMovementReason === MIGRATED_INITIAL_STOCK_REASON
    || row.isMigratedBaseline === true) {
    return ROTATION_HISTORY_SCOPES.MIGRATED_BASELINE;
  }
  if (!row.initialMovementAt && !row.hasInitialStockMovement) {
    return ROTATION_HISTORY_SCOPES.PARTIAL_HISTORY;
  }
  if (asQuantity(row.quantitySold) > 0 && asQuantity(row.saleMovementCount) === 0) {
    return ROTATION_HISTORY_SCOPES.PARTIAL_HISTORY;
  }
  return ROTATION_HISTORY_SCOPES.RECORDED_LEDGER;
}

function calculateDaysSinceIntake(intakeDate, asOfDate) {
  if (!intakeDate) return null;
  const intake = new Date(intakeDate);
  const asOf = new Date(asOfDate);
  if (Number.isNaN(intake.getTime()) || Number.isNaN(asOf.getTime())) return null;
  const elapsed = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate())
    - Date.UTC(intake.getUTCFullYear(), intake.getUTCMonth(), intake.getUTCDate());
  return elapsed >= 0 ? Math.floor(elapsed / 86400000) : null;
}

export function projectStockRotationV1Row(row = {}, { asOfDate = new Date() } = {}) {
  const balances = getInventoryBalances(row);
  return {
    internalCode: row.internalCode || null,
    title: row.title || null,
    lotCode: row.lotCode || null,
    lotName: row.lotName || null,
    categoryName: row.categoryName || null,
    brandName: row.brandName || null,
    publicationStatus: row.publicationStatus || row.status || null,
    stockStatus: deriveStockStatus(balances),
    intakeDate: row.intakeDate || null,
    daysSinceIntake: calculateDaysSinceIntake(row.intakeDate, asOfDate),
    ...balances,
    netSoldPercentage: calculateReportAggregatePercentage(
      balances.quantitySold,
      balances.quantityTotal,
    ),
    lastRecordedSaleAt: row.lastRecordedSaleAt || null,
    historyScope: resolveRotationHistoryScope(row),
  };
}

export function buildStockRotationV1Projection(sourceRows = [], options = {}) {
  const rows = sourceRows.map((row) => projectStockRotationV1Row(row, options));
  return createReportProjection({
    columns: STOCK_ROTATION_V1_COLUMNS,
    rows,
    totalRow: buildInventoryTotalRow(rows, { includeSoldPercentage: true }),
    summary: {
      rowCount: rows.length,
      partialHistoryRowCount: rows.filter(
        ({ historyScope }) => historyScope === ROTATION_HISTORY_SCOPES.PARTIAL_HISTORY,
      ).length,
      migratedBaselineRowCount: rows.filter(
        ({ historyScope }) => historyScope === ROTATION_HISTORY_SCOPES.MIGRATED_BASELINE,
      ).length,
    },
    metadata: {
      reportId: 'STOCK_ROTATION_V1',
      velocityClassification: null,
    },
  });
}
