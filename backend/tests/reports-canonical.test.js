import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import {
  REPORT_QUERY_SCHEMAS,
  costIntegrityReportQuerySchema,
  profitProjectionReportQuerySchema,
  realizedProfitsReportQuerySchema,
  salesReportQuerySchema,
} from '../src/modules/reports/reports.schemas.js';
import {
  REPORT_IDS,
  buildHistoricalSaleReportQuery,
  buildReportDownload,
  sanitizeReportAuditFilters,
} from '../src/modules/reports/reports.service.js';
import { logAudit } from '../src/modules/audit/audit.service.js';

const FIXED_NOW = new Date('2026-08-23T12:00:00.000Z');
const TEST_DIRECTORY = dirname(fileURLToPath(import.meta.url));

function historicalSale(overrides = {}) {
  return {
    orderNumber: 'ORD-2026-0001',
    orderStatus: 'APPROVED',
    approvedAt: '2026-08-20T15:00:00.000Z',
    paymentMethod: 'BANK_TRANSFER',
    shippingMethodDescriptionSnapshot: 'Retiro acordado',
    quantity: 1,
    articleTitleSnapshot: '=SUM(1,1)',
    categoryNameSnapshot: 'Abrigos históricos',
    brandNameSnapshot: 'Marca histórica',
    lotIdSnapshot: 4,
    lotCodeSnapshot: 'LOTE-0004',
    lotNameSnapshot: 'Lote histórico',
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
    customerEmail: 'private-email-sentinel',
    mpPaymentId: 'private-provider-sentinel',
    ...overrides,
  };
}

function currentArticle(overrides = {}) {
  return {
    id: 7,
    internalCode: 'ART-0007',
    title: '=SUM(1,1)',
    status: 'ACTIVE',
    publicationStatus: 'ACTIVE',
    lotId: 4,
    lotCode: 'LOTE-0004',
    lotName: 'Lote actual',
    categoryName: 'Abrigos',
    brandName: 'Marca',
    sizeCode: 'M',
    intakeDate: '2026-08-01',
    quantityTotal: 5,
    quantityAvailable: 2,
    quantityReserved: 1,
    quantitySold: 1,
    quantityLost: 1,
    salePrice: 150,
    discountType: 'NONE',
    discountValue: 0,
    discountedPrice: 150,
    purchasePriceItem: 100,
    purchasePriceShipping: 0,
    purchasePriceCourier: 0,
    customerPhone: 'private-phone-sentinel',
    providerReference: 'private-provider-sentinel',
    ...overrides,
  };
}

function createDependencies() {
  const audits = [];
  const articleFilters = [];
  const connection = {
    async execute(sql) {
      if (sql.includes('FROM article_inventory_movements')) {
        return [[
          {
            articleId: 7,
            movementType: 'INITIAL_STOCK',
            reason: 'Alta inicial',
            createdAt: '2026-08-01T12:00:00.000Z',
          },
          {
            articleId: 7,
            movementType: 'SALE',
            reason: 'Venta aprobada',
            createdAt: '2026-08-20T15:00:00.000Z',
          },
        ]];
      }
      if (sql.includes('FROM orders o')) return [[historicalSale()]];
      throw new Error(`Unexpected report SQL: ${sql}`);
    },
  };
  return {
    audits,
    articleFilters,
    dependencies: {
      connection,
      listArticles: async ({ filters }) => {
        articleFilters.push(filters);
        return [currentArticle()];
      },
      getCostingSettings: async () => ({ bankTaxRate: 0.025 }),
      logAudit: async (entry) => audits.push(entry),
      now: () => FIXED_NOW,
    },
  };
}

test('six report-specific schemas default XLSX and reject inapplicable or unknown filters', () => {
  assert.deepEqual(Object.keys(REPORT_QUERY_SCHEMAS), REPORT_IDS);
  assert.equal(salesReportQuerySchema.parse({}).format, 'xlsx');
  assert.equal(costIntegrityReportQuerySchema.parse({}).scope, 'ALL');
  assert.equal(costIntegrityReportQuerySchema.parse({}).unreliableOnly, true);
  assert.equal(profitProjectionReportQuerySchema.parse({ featured: 'false' }).featured, false);
  assert.equal(realizedProfitsReportQuerySchema.parse({ dataQuality: 'INCOMPLETE' }).dataQuality, 'INCOMPLETE');

  assert.throws(() => salesReportQuerySchema.parse({ status: 'PENDING' }));
  assert.throws(() => salesReportQuerySchema.parse({ categoryId: '1' }));
  assert.throws(() => salesReportQuerySchema.parse({ dateFrom: '2026-08-24', dateTo: '2026-08-23' }));
  assert.throws(() => costIntegrityReportQuerySchema.parse({ issueCode: 'UNAPPROVED_ISSUE' }));
  assert.throws(() => costIntegrityReportQuerySchema.parse({ scope: 'ALL', categoryId: '1' }));
  assert.doesNotThrow(() => costIntegrityReportQuerySchema.parse({ scope: 'CURRENT_ARTICLES', categoryId: '1' }));
});

test('historical report query fixes status/date truth and never joins current Article or customer data', () => {
  const query = buildHistoricalSaleReportQuery({
    dateFrom: '2026-08-01',
    dateTo: '2026-08-23',
    lotId: 4,
    paymentMethod: 'BANK_TRANSFER',
    shippingMethod: 'Retiro acordado',
    q: 'ORD-2026',
  });

  assert.deepEqual(query.params.slice(0, 2), ['APPROVED', 'SHIPPED']);
  assert.match(query.sql, /o\.approved_at IS NOT NULL/);
  assert.match(query.sql, /DATE\(o\.approved_at\)/);
  assert.match(query.sql, /oi\.lot_id_snapshot/);
  assert.doesNotMatch(query.sql, /JOIN\s+articles\b/i);
  assert.doesNotMatch(query.sql, /JOIN\s+(?:users|customers)\b/i);
  assert.doesNotMatch(query.sql, /payment_id|provider|webhook|email|phone|address/i);
});

test('all six canonical reports share projections across CSV/XLSX and audit only safe metadata', async () => {
  const { dependencies, audits, articleFilters } = createDependencies();
  const projections = new Map();
  const expectedStems = {
    sales: 'esadar-ventas',
    'profit-projection': 'esadar-proyeccion-ganancias',
    'realized-profits': 'esadar-ganancias',
    stock: 'esadar-stock',
    'stock-rotation': 'esadar-rotacion-stock',
    'cost-integrity': 'esadar-integridad-costos',
  };

  for (const reportId of REPORT_IDS) {
    for (const format of ['csv', 'xlsx']) {
      const result = await buildReportDownload({
        reportId,
        query: {
          format,
          q: 'private-search-sentinel',
          ...(reportId === 'cost-integrity' ? { scope: 'ALL', unreliableOnly: false } : {}),
        },
        auditContext: {
          actorUserId: 1,
          actorLabel: 'admin@example.test',
          source: 'TEST',
          ipAddress: '127.0.0.1',
          userAgent: 'node-test',
        },
        dependencies,
      });

      assert.equal(result.itemCount > 0, true, reportId);
      assert.equal(result.fileName, `${expectedStems[reportId]}-2026-08-23.${format}`);
      assert.equal(
        result.contentType,
        format === 'csv'
          ? 'text/csv; charset=utf-8'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );

      if (projections.has(reportId)) assert.deepEqual(result.projection, projections.get(reportId));
      else projections.set(reportId, result.projection);

      if (format === 'csv') {
        const csv = result.payload.toString('utf8');
        assert.equal(csv.startsWith('\uFEFF'), true);
        assert.match(csv, /'=SUM\(1,1\)/);
        assert.doesNotMatch(csv, /private-(?:email|phone|provider)-sentinel/);
      } else {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(result.payload);
        const worksheet = workbook.getWorksheet('Reporte');
        assert.ok(worksheet);
        assert.equal(worksheet.getRow(1).cellCount, result.projection.columns.length);
        const values = JSON.stringify(worksheet.getSheetValues());
        assert.doesNotMatch(values, /private-(?:email|phone|provider)-sentinel/);
        const formulaCandidate = worksheet.getCell('B2');
        if (formulaCandidate.value === '=SUM(1,1)') {
          assert.equal(formulaCandidate.type, ExcelJS.ValueType.String);
        }
      }
    }
  }

  assert.equal(audits.length, 12);
  const expectedAuditReportIds = REPORT_IDS.flatMap((reportId) => [reportId, reportId]);
  for (const [index, audit] of audits.entries()) {
    assert.equal(audit.actionCode, 'REPORT_EXPORT_CREATED');
    assert.equal(audit.entityType, 'reports');
    assert.equal(audit.entityId, null);
    assert.equal(audit.metadataJson.reportId, expectedAuditReportIds[index]);
    assert.equal(audit.metadataJson.rowCount > 0, true);
    assert.equal(audit.metadataJson.filters.hasCommercialSearch, true);
    assert.doesNotMatch(JSON.stringify(audit.metadataJson), /private-search-sentinel/);
  }
  assert.equal(new Set(audits.map((audit) => audit.metadataJson.reportId)).size, REPORT_IDS.length);
  assert.ok(articleFilters.length > 0);
  assert.ok(articleFilters.every((filters) => filters.status === undefined));
});

test('report audit entity ID remains compatible with the nullable numeric DB column', () => {
  const schema = readFileSync(
    resolve(TEST_DIRECTORY, '../../db/scripts/01_from_scratch_superadmin_seed.sql'),
    'utf8',
  );
  const auditTable = schema.match(/CREATE TABLE audit_log\s*\(([\s\S]*?)\) ENGINE=InnoDB;/i)?.[1];

  assert.ok(auditTable);
  assert.match(auditTable, /\bentity_id BIGINT UNSIGNED NULL\b/i);
});

test('generic audit persistence preserves a null report entity ID', async () => {
  let capturedParams = null;
  const connection = {
    async execute(_sql, params) {
      capturedParams = params;
    },
  };

  await logAudit({
    actionCode: 'REPORT_EXPORT_CREATED',
    entityType: 'reports',
    entityId: null,
    metadataJson: { reportId: 'cost-integrity' },
  }, connection);

  assert.equal(capturedParams[4], null);
  assert.deepEqual(JSON.parse(capturedParams[7]), { reportId: 'cost-integrity' });
});

test('safe audit filter projection replaces commercial text with presence flags', () => {
  assert.deepEqual(sanitizeReportAuditFilters({
    q: 'customer@example.test',
    shippingMethod: 'Private shipping text',
    lotId: 9,
    providerReference: 'secret',
  }), {
    lotId: 9,
    hasCommercialSearch: true,
    hasShippingMethodFilter: true,
  });
});
