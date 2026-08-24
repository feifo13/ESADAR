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
import { projectionToExportRows } from '../src/modules/reports/report-renderers.js';

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

function createDependencies({
  currentArticles = [currentArticle()],
  historicalSales = [historicalSale()],
  inventoryMovements = [
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
  ],
} = {}) {
  const audits = [];
  const articleFilters = [];
  const connection = {
    async execute(sql) {
      if (sql.includes('FROM article_inventory_movements')) return [inventoryMovements];
      if (sql.includes('FROM orders o')) return [historicalSales];
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
        return currentArticles;
      },
      getCostingSettings: async () => ({ bankTaxRate: 0.025 }),
      logAudit: async (entry) => audits.push(entry),
      now: () => FIXED_NOW,
    },
  };
}

function parseCsvPayload(payload) {
  const text = payload.toString('utf8').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  return rows.filter((candidate) => !(candidate.length === 1 && candidate[0] === ''));
}

function countBlankRows(rows) {
  return rows.filter((row) => row.every((value) => value == null || value === '')).length;
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

test('all six canonical reports render one numerically correct total with CSV/XLSX parity', async () => {
  const currentArticles = [
    currentArticle(),
    currentArticle({
      id: 8,
      internalCode: 'ART-0008',
      title: 'Segundo artículo',
      quantityTotal: 3,
      quantityAvailable: 3,
      quantityReserved: 0,
      quantitySold: 0,
      quantityLost: 0,
      salePrice: 100,
      discountedPrice: 100,
      purchasePriceItem: 50,
      purchasePriceShipping: 10,
      purchasePriceCourier: 5,
    }),
  ];
  const historicalSales = [
    historicalSale(),
    historicalSale({
      orderNumber: 'ORD-2026-0002',
      approvedAt: '2026-08-21T15:00:00.000Z',
      quantity: 2,
      articleTitleSnapshot: 'Segundo artículo histórico',
      salePriceSnapshot: 80,
      finalUnitPriceSnapshot: 75,
      lineTotalSnapshot: 150,
      purchasePriceItemSnapshot: 40,
      purchasePriceShippingSnapshot: 10,
      purchasePriceCourierSnapshot: 5,
      purchasePriceTotalSnapshot: 55,
      bankTaxRateSnapshot: 0.025,
      bankTaxBaseSnapshot: 50,
      bankTaxSnapshot: 1.25,
      totalCostSnapshot: 56.25,
      profitSnapshot: 93.75,
    }),
  ];
  const { dependencies, audits } = createDependencies({
    currentArticles,
    historicalSales,
    inventoryMovements: [
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
      {
        articleId: 8,
        movementType: 'INITIAL_STOCK',
        reason: 'Alta inicial',
        createdAt: '2026-08-02T12:00:00.000Z',
      },
    ],
  });
  const expectations = {
    sales: {
      businessCount: 2,
      labelKey: 'orderNumber',
      total: { orderNumber: 'TOTAL', quantity: 3, finalUnitPrice: null, lineTotal: 300 },
    },
    'profit-projection': {
      businessCount: 2,
      labelKey: 'internalCode',
      total: {
        internalCode: 'TOTAL',
        quantityTotal: 8,
        quantityAvailable: 5,
        quantityReserved: 1,
        quantitySold: 1,
        quantityLost: 1,
        purchasePriceItem: 150,
        purchasePriceShipping: 10,
        purchasePriceCourier: 5,
        purchasePriceTotal: 165,
        bankTaxBase: 160,
        bankTaxPercent: null,
        bankTax: 4,
        totalCost: 169,
        effectiveSalePrice: 250,
        estimatedProfit: 81,
        estimatedMargin: 32.4,
      },
    },
    'realized-profits': {
      businessCount: 2,
      labelKey: 'orderNumber',
      total: {
        orderNumber: 'TOTAL',
        quantity: 3,
        salePrice: null,
        finalUnitPrice: null,
        revenue: 300,
        purchasePriceItem: 140,
        purchasePriceShipping: 10,
        purchasePriceCourier: 5,
        purchasePriceTotal: 155,
        bankTaxRate: null,
        bankTaxBase: 150,
        bankTax: 1.25,
        totalCost: 156.25,
        realizedProfit: 143.75,
        realizedMargin: 47.92,
      },
    },
    stock: {
      businessCount: 2,
      labelKey: 'internalCode',
      total: {
        internalCode: 'TOTAL',
        quantityTotal: 8,
        quantityAvailable: 5,
        quantityReserved: 1,
        quantitySold: 1,
        quantityLost: 1,
      },
    },
    'stock-rotation': {
      businessCount: 2,
      labelKey: 'internalCode',
      total: {
        internalCode: 'TOTAL',
        daysSinceIntake: null,
        quantityTotal: 8,
        quantityAvailable: 5,
        quantityReserved: 1,
        quantitySold: 1,
        quantityLost: 1,
        netSoldPercentage: 12.5,
      },
    },
    'cost-integrity': {
      businessCount: 4,
      labelKey: 'scope',
      total: {
        scope: 'TOTAL',
        itemCost: null,
        effectiveSalePrice: null,
        dataQuality: 'Filas con problemas: 0',
        issueCodes: 'Incidencias detectadas: 0',
      },
    },
  };
  const renderedByReport = new Map();

  for (const reportId of REPORT_IDS) {
    const expectation = expectations[reportId];
    const renderedByFormat = {};
    for (const format of ['csv', 'xlsx']) {
      const result = await buildReportDownload({
        reportId,
        query: {
          format,
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
      const { projection } = result;
      assert.equal(projection.rows.length, expectation.businessCount, `${reportId}/${format}`);
      assert.equal(result.itemCount, expectation.businessCount, `${reportId}/${format}`);
      for (const [key, value] of Object.entries(expectation.total)) {
        assert.equal(projection.totalRow[key], value, `${reportId}/${format}/${key}`);
      }

      const headers = projection.columns.map(({ header }) => header);
      const labelIndex = projection.columns.findIndex(({ key }) => key === expectation.labelKey);
      const expectedExportTotal = projectionToExportRows(projection).at(-1);
      const expectedTotalValues = headers.map((header) => expectedExportTotal[header]);

      if (format === 'csv') {
        const csvRows = parseCsvPayload(result.payload);
        assert.equal(csvRows.length - 2, expectation.businessCount, reportId);
        assert.equal(csvRows.slice(1).filter((row) => row[labelIndex] === 'TOTAL').length, 1, reportId);
        assert.equal(countBlankRows(csvRows.slice(1)), 0, reportId);
        assert.deepEqual(
          csvRows.at(-1),
          expectedTotalValues.map((value) => String(value ?? '')),
          reportId,
        );
        renderedByFormat.csv = { result, totalValues: csvRows.at(-1) };
      } else {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(result.payload);
        const worksheet = workbook.getWorksheet('Reporte');
        const worksheetRows = [];
        for (let rowNumber = 2; rowNumber <= worksheet.actualRowCount; rowNumber += 1) {
          worksheetRows.push(headers.map((_, index) => worksheet.getRow(rowNumber).getCell(index + 1).value));
        }
        const totalWorksheetRow = worksheet.getRow(worksheet.actualRowCount);
        const totalValues = headers.map((_, index) => totalWorksheetRow.getCell(index + 1).value ?? '');
        assert.equal(worksheet.actualRowCount - 2, expectation.businessCount, reportId);
        assert.equal(worksheetRows.filter((row) => row[labelIndex] === 'TOTAL').length, 1, reportId);
        assert.equal(countBlankRows(worksheetRows), 0, reportId);
        assert.deepEqual(totalValues, expectedTotalValues.map((value) => value ?? ''), reportId);
        assert.equal(totalWorksheetRow.font.bold, true, reportId);
        for (const [index, expectedValue] of expectedTotalValues.entries()) {
          const cell = totalWorksheetRow.getCell(index + 1);
          assert.equal(cell.formula, undefined, `${reportId}/${headers[index]}`);
          if (typeof expectedValue === 'number') {
            assert.equal(cell.type, ExcelJS.ValueType.Number, `${reportId}/${headers[index]}`);
          }
        }
        renderedByFormat.xlsx = { result, totalValues };
      }
    }

    assert.deepEqual(renderedByFormat.csv.result.projection, renderedByFormat.xlsx.result.projection);
    assert.deepEqual(
      renderedByFormat.csv.totalValues,
      renderedByFormat.xlsx.totalValues.map((value) => String(value ?? '')),
      reportId,
    );
    renderedByReport.set(reportId, renderedByFormat.csv.result.projection);
  }

  const profitProjection = renderedByReport.get('profit-projection');
  assert.notEqual(
    profitProjection.totalRow.estimatedMargin,
    Number(profitProjection.rows.reduce((sum, row) => sum + row.estimatedMargin, 0).toFixed(2)),
  );
  const realizedProjection = renderedByReport.get('realized-profits');
  assert.notEqual(
    realizedProjection.totalRow.realizedMargin,
    Number(realizedProjection.rows.reduce((sum, row) => sum + row.realizedMargin, 0).toFixed(2)),
  );
  const rotationProjection = renderedByReport.get('stock-rotation');
  assert.notEqual(
    rotationProjection.totalRow.netSoldPercentage,
    Number(rotationProjection.rows.reduce((sum, row) => sum + row.netSoldPercentage, 0).toFixed(2)),
  );
  const stockTotal = renderedByReport.get('stock').totalRow;
  assert.equal(
    stockTotal.quantityTotal,
    stockTotal.quantityAvailable
      + stockTotal.quantityReserved
      + stockTotal.quantitySold
      + stockTotal.quantityLost,
  );

  assert.equal(audits.length, REPORT_IDS.length * 2);
  for (const [index, audit] of audits.entries()) {
    const reportId = REPORT_IDS[Math.floor(index / 2)];
    assert.equal(audit.entityId, null);
    assert.equal(audit.metadataJson.reportId, reportId);
    assert.equal(audit.metadataJson.rowCount, expectations[reportId].businessCount);
  }
});

test('empty Cost Integrity exports contain only headers and one total row in CSV and XLSX', async () => {
  const { dependencies, audits } = createDependencies({
    currentArticles: [],
    historicalSales: [],
    inventoryMovements: [],
  });
  const outputs = {};

  for (const format of ['csv', 'xlsx']) {
    const result = await buildReportDownload({
      reportId: 'cost-integrity',
      query: { format, scope: 'ALL', unreliableOnly: false },
      auditContext: {
        actorUserId: 1,
        actorLabel: 'admin@example.test',
        source: 'TEST',
        ipAddress: '127.0.0.1',
        userAgent: 'node-test',
      },
      dependencies,
    });
    assert.equal(result.itemCount, 0);
    assert.equal(result.projection.rows.length, 0);
    assert.equal(result.projection.totalRow.scope, 'TOTAL');
    assert.equal(result.projection.totalRow.dataQuality, 'Filas con problemas: 0');
    assert.equal(result.projection.totalRow.issueCodes, 'Incidencias detectadas: 0');

    if (format === 'csv') {
      const rows = parseCsvPayload(result.payload);
      assert.equal(rows.length, 2);
      assert.equal(countBlankRows(rows.slice(1)), 0);
      assert.equal(rows[1][0], 'TOTAL');
      outputs.csv = rows[1];
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(result.payload);
      const worksheet = workbook.getWorksheet('Reporte');
      assert.equal(worksheet.actualRowCount, 2);
      const totalRow = worksheet.getRow(2);
      const values = result.projection.columns.map(
        (_, index) => totalRow.getCell(index + 1).value ?? '',
      );
      assert.equal(countBlankRows([values]), 0);
      assert.equal(values[0], 'TOTAL');
      assert.equal(totalRow.font.bold, true);
      outputs.xlsx = values.map((value) => String(value ?? ''));
    }
  }

  assert.deepEqual(outputs.csv, outputs.xlsx);
  assert.equal(audits.length, 2);
  assert.ok(audits.every((audit) => audit.entityId === null));
  assert.ok(audits.every((audit) => audit.metadataJson.reportId === 'cost-integrity'));
  assert.ok(audits.every((audit) => audit.metadataJson.rowCount === 0));
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
