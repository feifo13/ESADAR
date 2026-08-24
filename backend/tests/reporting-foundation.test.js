import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {
  COST_INTEGRITY_ISSUE_CODES,
  HISTORICAL_FINANCIAL_SNAPSHOT_FIELDS,
  evaluateCurrentArticleCostIntegrity,
  evaluateHistoricalSaleCostIntegrity,
} from '../src/modules/reports/cost-integrity.js';
import {
  CANONICAL_COMPLETED_SALE_STATUSES,
  CANONICAL_SALE_DATE_FIELD,
  buildCanonicalRealizedProfitProjection,
  evaluateRealizedProfitSnapshotCompleteness,
} from '../src/modules/reports/realized-profit.projection.js';
import { getCanonicalCompletedSaleStatusParameters } from '../src/modules/reports/completed-sales.js';
import { createReportProjection } from '../src/modules/reports/report-projection.js';
import {
  renderReportProjectionCsv,
  renderReportProjectionXlsx,
} from '../src/modules/reports/report-renderers.js';
import {
  MIGRATED_INITIAL_STOCK_REASON,
  ROTATION_HISTORY_SCOPES,
  buildCurrentStockProjection,
  buildStockRotationV1Projection,
  projectCurrentStockRow,
  resolveRotationHistoryScope,
} from '../src/modules/reports/stock.projection.js';

function completeHistoricalSale(overrides = {}) {
  return {
    orderNumber: 'ORD-2026-0001',
    orderStatus: 'APPROVED',
    approvedAt: '2026-08-20T15:00:00.000Z',
    articleTitleSnapshot: 'Campera histórica',
    lotCodeSnapshot: 'LOTE-0001',
    lotNameSnapshot: 'Lote histórico',
    categoryNameSnapshot: 'Abrigos históricos',
    brandNameSnapshot: 'Marca histórica',
    shippingMethodDescriptionSnapshot: 'Retiro',
    quantity: 1,
    salePriceSnapshot: 150,
    finalUnitPriceSnapshot: 150,
    lineTotalSnapshot: 150,
    purchasePriceItemSnapshot: 100,
    purchasePriceShippingSnapshot: 0,
    purchasePriceCourierSnapshot: 0,
    purchasePriceTotalSnapshot: 100,
    bankTaxRateSnapshot: 0,
    bankTaxBaseSnapshot: 100,
    bankTaxSnapshot: 0,
    totalCostSnapshot: 100,
    profitSnapshot: 50,
    ...overrides,
  };
}

test('canonical realized profit defines strict completed statuses and approved_at date', () => {
  assert.deepEqual(CANONICAL_COMPLETED_SALE_STATUSES, ['APPROVED', 'SHIPPED']);
  assert.deepEqual(getCanonicalCompletedSaleStatusParameters(), ['APPROVED', 'SHIPPED']);
  assert.equal(CANONICAL_SALE_DATE_FIELD, 'approved_at');

  const projection = buildCanonicalRealizedProfitProjection([
    completeHistoricalSale({ orderStatus: 'APPROVED' }),
    completeHistoricalSale({ orderStatus: 'SHIPPED', orderNumber: 'ORD-2' }),
    completeHistoricalSale({ orderStatus: 'PENDING', orderNumber: 'ORD-3' }),
    completeHistoricalSale({ orderStatus: 'RESERVED', orderNumber: 'ORD-4' }),
    completeHistoricalSale({ orderStatus: 'CANCELLED', orderNumber: 'ORD-5' }),
    completeHistoricalSale({ orderStatus: 'EXPIRED', orderNumber: 'ORD-6' }),
  ]);

  assert.deepEqual(projection.rows.map(({ orderStatus }) => orderStatus), ['APPROVED', 'SHIPPED']);
  assert.equal(projection.summary.completedSaleRowCount, 2);
  assert.equal(projection.summary.reliableProfitTotal, 100);
});

test('complete historical profit is immutable to current Article changes', () => {
  const base = completeHistoricalSale({
    currentArticle: {
      purchasePriceItem: 9999,
      categoryName: 'Categoría actual A',
      brandName: 'Marca actual A',
    },
  });
  const changed = completeHistoricalSale({
    currentArticle: {
      purchasePriceItem: 1,
      categoryName: 'Categoría actual B',
      brandName: 'Marca actual B',
    },
  });

  assert.deepEqual(
    buildCanonicalRealizedProfitProjection([base]),
    buildCanonicalRealizedProfitProjection([changed]),
  );
});

test('sales projection preserves missing historical monetary snapshots as unavailable', async () => {
  const { buildCanonicalSalesProjection } = await import('../src/modules/reports/sales.projection.js');
  const projection = buildCanonicalSalesProjection([
    completeHistoricalSale({ finalUnitPriceSnapshot: null, lineTotalSnapshot: null }),
  ]);

  assert.equal(projection.rows[0].finalUnitPrice, null);
  assert.equal(projection.rows[0].lineTotal, null);
  assert.equal(projection.summary.revenueTotal, 0);
});

test('incomplete historical snapshots are preserved and never filled from current costs', () => {
  const sale = completeHistoricalSale({
    purchasePriceItemSnapshot: null,
    profitSnapshot: null,
    purchasePriceItem: 20,
    purchasePriceShipping: 0,
    purchasePriceCourier: 0,
    bankTaxRate: 0.025,
    categoryName: 'Categoría actual',
    brandName: 'Marca actual',
  });
  const projection = buildCanonicalRealizedProfitProjection([sale]);

  assert.equal(projection.rows.length, 1);
  assert.equal(projection.rows[0].dataQuality, 'INCOMPLETE');
  assert.equal(projection.rows[0].realizedProfit, null);
  assert.equal(projection.rows[0].categoryName, 'Abrigos históricos');
  assert.equal(projection.rows[0].brandName, 'Marca histórica');
  assert.ok(projection.rows[0].issueCodes.includes('MISSING_HISTORICAL_SNAPSHOT'));
  assert.ok(projection.rows[0].issueCodes.includes('UNCOMPUTABLE_PROFIT'));
  assert.equal(projection.summary.incompleteRowCount, 1);
  assert.equal(projection.summary.completeRowCount, 0);
  assert.equal(projection.summary.reliableProfitTotal, 0);
});

test('snapshot completeness documents and enforces the actual financial field set', () => {
  assert.deepEqual(HISTORICAL_FINANCIAL_SNAPSHOT_FIELDS, [
    'finalUnitPriceSnapshot',
    'lineTotalSnapshot',
    'purchasePriceItemSnapshot',
    'purchasePriceShippingSnapshot',
    'purchasePriceCourierSnapshot',
    'purchasePriceTotalSnapshot',
    'bankTaxRateSnapshot',
    'bankTaxBaseSnapshot',
    'bankTaxSnapshot',
    'totalCostSnapshot',
    'profitSnapshot',
  ]);
  assert.equal(evaluateRealizedProfitSnapshotCompleteness(completeHistoricalSale()).dataQuality, 'COMPLETE');
});

test('cost integrity distinguishes invalid item cost from legitimate zero components', () => {
  const currentValid = evaluateCurrentArticleCostIntegrity({
    salePrice: 100,
    discountType: 'NONE',
    purchasePriceItem: 50,
    purchasePriceShipping: 0,
    purchasePriceCourier: 0,
  }, { bankTaxRate: 0 });
  const currentInvalid = evaluateCurrentArticleCostIntegrity({
    salePrice: 100,
    purchasePriceItem: 0,
    purchasePriceShipping: 0,
    purchasePriceCourier: 0,
  }, { bankTaxRate: 0 });
  const historicalValid = evaluateHistoricalSaleCostIntegrity(completeHistoricalSale());

  assert.deepEqual(currentValid.issueCodes, []);
  assert.deepEqual(historicalValid.issueCodes, []);
  assert.deepEqual(currentInvalid.issueCodes, [COST_INTEGRITY_ISSUE_CODES.INVALID_ITEM_COST]);
});

test('current-cost fallback is an explicit historical integrity issue', () => {
  const result = evaluateHistoricalSaleCostIntegrity(completeHistoricalSale({
    usesCurrentCostFallback: true,
  }));
  assert.ok(result.issueCodes.includes(COST_INTEGRITY_ISSUE_CODES.CURRENT_COST_FALLBACK_FORBIDDEN));
  assert.equal(result.dataQuality, 'INCOMPLETE');
});

test('current stock projection enforces balance invariant and preserves status distinction', () => {
  const valid = projectCurrentStockRow({
    internalCode: 'ART-1',
    status: 'DRAFT',
    quantityTotal: 5,
    quantityAvailable: 2,
    quantityReserved: 1,
    quantitySold: 1,
    quantityLost: 1,
  });
  const projection = buildCurrentStockProjection([
    valid,
    { ...valid, internalCode: 'ART-2', quantityTotal: 9 },
  ]);

  assert.equal(valid.publicationStatus, 'DRAFT');
  assert.equal(valid.stockStatus, 'ACTIVE');
  assert.equal(valid.inventoryDataQuality, 'COMPLETE');
  assert.equal(projection.summary.invalidBalanceRowCount, 1);
});

test('rotation V1 exposes truthful scopes and no velocity classification', () => {
  assert.equal(resolveRotationHistoryScope({
    initialMovementReason: MIGRATED_INITIAL_STOCK_REASON,
  }), ROTATION_HISTORY_SCOPES.MIGRATED_BASELINE);
  assert.equal(resolveRotationHistoryScope({
    hasInitialStockMovement: true,
    quantitySold: 1,
    saleMovementCount: 0,
  }), ROTATION_HISTORY_SCOPES.PARTIAL_HISTORY);
  assert.equal(resolveRotationHistoryScope({
    initialMovementAt: '2026-08-01T00:00:00.000Z',
    quantitySold: 1,
    saleMovementCount: 1,
  }), ROTATION_HISTORY_SCOPES.RECORDED_LEDGER);

  const projection = buildStockRotationV1Projection([{
    internalCode: 'ART-1',
    intakeDate: '2026-08-01',
    quantityTotal: 4,
    quantityAvailable: 2,
    quantityReserved: 0,
    quantitySold: 2,
    quantityLost: 0,
    initialMovementAt: '2026-08-01T00:00:00.000Z',
    saleMovementCount: 2,
    lastRecordedSaleAt: '2026-08-10T10:00:00.000Z',
  }], { asOfDate: '2026-08-21T00:00:00.000Z' });

  assert.equal(projection.rows[0].daysSinceIntake, 20);
  assert.equal(projection.rows[0].netSoldPercentage, 50);
  assert.equal(projection.rows[0].historyScope, 'RECORDED_LEDGER');
  assert.equal(projection.metadata.velocityClassification, null);
  assert.ok(!projection.columns.some(({ key }) => /velocity/i.test(key)));
});

test('explicit report allowlists strip PII, session, auth, and provider fields', async () => {
  const source = {
    orderNumber: 'ORD-SAFE',
    amount: 125,
    customerEmail: 'private-email-sentinel',
    phone: 'private-phone-sentinel',
    postalAddress: 'private-address-sentinel',
    instagram: 'private-social-sentinel',
    sessionToken: 'private-session-sentinel',
    authIdentifier: 'private-auth-sentinel',
    providerReference: 'private-provider-sentinel',
    rawProviderData: 'private-raw-sentinel',
    nestedCommercialField: { email: 'private-nested-sentinel' },
  };
  const projection = createReportProjection({
    columns: [
      { key: 'orderNumber', header: 'Orden' },
      { key: 'amount', header: 'Importe' },
      { key: 'nestedCommercialField', header: 'Campo comercial' },
    ],
    rows: [source],
    metadata: { reportId: 'SECURITY_TEST' },
  });
  const csv = renderReportProjectionCsv(projection).toString('utf8');
  const xlsx = await renderReportProjectionXlsx(projection);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(xlsx);
  const serialized = JSON.stringify(projection);
  const rendered = `${csv}\n${JSON.stringify(workbook.getWorksheet('Reporte').getSheetValues())}`;

  for (const sentinel of Object.values(source).filter((value) => String(value).startsWith('private-'))) {
    assert.ok(!serialized.includes(sentinel));
    assert.ok(!rendered.includes(sentinel));
  }
  assert.ok(!serialized.includes('private-nested-sentinel'));
  assert.ok(!rendered.includes('private-nested-sentinel'));
  assert.deepEqual(projection.rows[0], {
    orderNumber: 'ORD-SAFE',
    amount: 125,
    nestedCommercialField: null,
  });
  assert.match(csv, /ORD-SAFE,125/);
});

test('canonical report column policy rejects explicitly unsafe columns', () => {
  assert.throws(() => createReportProjection({
    columns: [{ key: 'sessionToken', header: 'Sesión' }],
    rows: [],
  }), /Forbidden canonical report column/);
});
