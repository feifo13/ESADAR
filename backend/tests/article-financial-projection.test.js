import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildArticleFinancialProjectionRows,
  buildArticleLotFinancialSummary,
  buildArticleProfitProjectionSummary,
} from '../src/modules/articles/article-financial-projection.js';

const representativeArticle = {
  lotCode: 'LOTE-0001',
  lotName: 'Lote inicial',
  lotStatus: 'OPEN',
  internalCode: 'ART-001',
  title: 'Campera',
  status: 'ACTIVE',
  categoryName: 'Abrigos',
  brandName: 'Marca',
  sizeCode: 'M',
  intakeDate: '2026-08-01T00:00:00.000Z',
  quantityTotal: 3,
  quantityAvailable: 1,
  quantityReserved: 1,
  quantitySold: 1,
  salePrice: 2000,
  discountType: 'PERCENT',
  discountValue: 10,
  purchasePriceItem: 1000,
  purchasePriceShipping: 150,
  purchasePriceCourier: 100,
};

test('shared article financial projection preserves representative row output', () => {
  const rows = buildArticleFinancialProjectionRows(
    [representativeArticle],
    { bankTaxRate: 0.025 },
  );

  assert.deepEqual(rows[0], {
    lotCode: 'LOTE-0001',
    lotName: 'Lote inicial',
    lotStatus: 'OPEN',
    internalCode: 'ART-001',
    title: 'Campera',
    status: 'ACTIVE',
    categoryName: 'Abrigos',
    brandName: 'Marca',
    sizeLabel: 'M',
    intakeDate: '2026-08-01',
    quantityTotal: 3,
    quantityAvailable: 1,
    quantityReserved: 1,
    quantitySold: 1,
    salePrice: 2000,
    discountType: 'Porcentaje',
    discountValue: 10,
    effectiveSalePrice: 1800,
    purchasePriceItem: 1000,
    purchasePriceShipping: 150,
    purchasePriceCourier: 100,
    purchasePriceTotal: 1250,
    bankTaxBase: 1150,
    bankTaxPercent: 2.5,
    bankTax: 28.75,
    totalCost: 1278.75,
    estimatedProfit: 521.25,
    estimatedMargin: 28.96,
    result: 'Ganancia',
  });
});

test('Articles and Lots summaries reuse shared financial totals without output drift', () => {
  const projectionRows = buildArticleFinancialProjectionRows(
    [representativeArticle],
    { bankTaxRate: 0.025 },
  );
  const articleSummary = buildArticleProfitProjectionSummary(projectionRows);
  const lotSummary = buildArticleLotFinancialSummary(
    [representativeArticle],
    { bankTaxRate: 0.025 },
  );

  assert.deepEqual(articleSummary, {
    articleCount: 1,
    totalSalePrice: 2000,
    totalEffectiveSalePrice: 1800,
    totalPurchasePriceItem: 1000,
    totalPurchasePriceShipping: 150,
    totalPurchasePriceCourier: 100,
    totalPurchasePrice: 1250,
    totalBankTaxBase: 1150,
    totalBankTax: 28.75,
    totalCost: 1278.75,
    totalEstimatedProfit: 521.25,
    weightedMargin: 28.96,
    profitCount: 1,
    lossCount: 0,
    breakEvenCount: 0,
  });
  assert.deepEqual(lotSummary, {
    articleCount: 1,
    stockTotal: 3,
    stockAvailable: 1,
    stockReserved: 1,
    stockSold: 1,
    totalSalePrice: 2000,
    totalEffectiveSalePrice: 1800,
    totalPurchasePriceItem: 1000,
    totalPurchasePriceShipping: 150,
    totalPurchasePriceCourier: 100,
    totalPurchasePriceTotal: 1250,
    totalBankTaxBase: 1150,
    totalBankTax: 28.75,
    totalCost: 1278.75,
    totalEstimatedProfit: 521.25,
    weightedEstimatedMargin: 28.96,
    profitCount: 1,
    lossCount: 0,
    breakEvenCount: 0,
  });
});
