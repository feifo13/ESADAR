import test from 'node:test';
import assert from 'node:assert/strict';
import { statisticsArticleMarginsQuerySchema } from '../src/modules/statistics/statistics.schemas.js';
import { calculateArticleMarginMetrics } from '../src/modules/statistics/statistics.article-margins.service.js';
import { calculateBankTax, calculateTotals } from '../src/modules/statistics/statistics.margin-calculator.js';

test('article margin metrics calculate values without discount', () => {
  const metrics = calculateArticleMarginMetrics({
    salePrice: 2000,
    discountType: 'NONE',
    discountValue: 0,
    purchasePriceItem: 1000,
    purchasePriceShipping: 150,
    purchasePriceCourier: 100,
  });

  assert.equal(metrics.effectiveSalePrice, 2000);
  assert.equal(metrics.bankTaxBase, 1150);
  assert.equal(metrics.bankTax, 28.75);
  assert.equal(metrics.bankTaxPercent, 2.5);
  assert.equal(metrics.purchasePriceTotal, 1250);
  assert.equal(metrics.totalCost, 1278.75);
  assert.equal(metrics.estimatedProfit, 721.25);
  assert.equal(metrics.estimatedMargin, 36.06);
});

test('article margin metrics calculate fixed discounts', () => {
  const metrics = calculateArticleMarginMetrics({
    salePrice: 2000,
    discountType: 'FIXED',
    discountValue: 500,
    purchasePriceItem: 1000,
    purchasePriceShipping: 150,
    purchasePriceCourier: 100,
  });

  assert.equal(metrics.effectiveSalePrice, 1500);
  assert.equal(metrics.bankTax, 28.75);
  assert.equal(metrics.totalCost, 1278.75);
  assert.equal(metrics.estimatedProfit, 221.25);
  assert.equal(metrics.estimatedMargin, 14.75);
});

test('article margin metrics calculate percentage discounts', () => {
  const metrics = calculateArticleMarginMetrics({
    salePrice: 2000,
    discountType: 'PERCENT',
    discountValue: 10,
    purchasePriceItem: 1000,
    purchasePriceShipping: 150,
    purchasePriceCourier: 100,
  });

  assert.equal(metrics.effectiveSalePrice, 1800);
  assert.equal(metrics.bankTax, 28.75);
  assert.equal(metrics.totalCost, 1278.75);
  assert.equal(metrics.estimatedProfit, 521.25);
  assert.equal(metrics.estimatedMargin, 28.96);
});

test('article margin metrics keep margin at zero when effective price is zero', () => {
  const metrics = calculateArticleMarginMetrics({
    salePrice: 500,
    discountType: 'FIXED',
    discountValue: 700,
    purchasePriceItem: 250,
  });

  assert.equal(metrics.effectiveSalePrice, 0);
  assert.equal(metrics.bankTax, 6.25);
  assert.equal(metrics.estimatedProfit, -256.25);
  assert.equal(metrics.estimatedMargin, 0);
});

test('article margin metrics expose negative profit', () => {
  const metrics = calculateArticleMarginMetrics({
    salePrice: 900,
    discountType: 'NONE',
    purchasePriceItem: 1000,
    purchasePriceShipping: 100,
    purchasePriceCourier: 100,
  });

  assert.equal(metrics.purchasePriceTotal, 1200);
  assert.equal(metrics.bankTax, 27.5);
  assert.equal(metrics.estimatedProfit, -327.5);
  assert.equal(metrics.estimatedMargin, -36.39);
});

test('bank tax uses only item cost and USA shipping cost', () => {
  assert.equal(calculateBankTax(1000, 150), 28.75);
  assert.equal(calculateBankTax(1000, 150, { bankTaxRate: 0.03 }), 34.5);
  assert.notEqual(calculateBankTax(1000, 150), 50);

  const metrics = calculateArticleMarginMetrics({
    salePrice: 2000,
    discountType: 'NONE',
    purchasePriceItem: 1000,
    purchasePriceShipping: 150,
    purchasePriceCourier: 900,
  });

  assert.equal(metrics.bankTax, 28.75);
});

test('article margin totals accumulate costs and calculate weighted total margin', () => {
  const rows = [
    calculateArticleMarginMetrics({
      salePrice: 2000,
      discountType: 'NONE',
      purchasePriceItem: 1000,
      purchasePriceShipping: 150,
      purchasePriceCourier: 100,
    }),
    calculateArticleMarginMetrics({
      salePrice: 2000,
      discountType: 'FIXED',
      discountValue: 500,
      purchasePriceItem: 1000,
      purchasePriceShipping: 150,
      purchasePriceCourier: 100,
    }),
  ];

  const totals = calculateTotals(rows);
  assert.equal(totals.articleCount, 2);
  assert.equal(totals.totalEffectiveSalePrice, 3500);
  assert.equal(totals.totalBankTaxBase, 2300);
  assert.equal(totals.totalBankTax, 57.5);
  assert.equal(totals.totalCost, 2557.5);
  assert.equal(totals.totalEstimatedProfit, 942.5);
  assert.equal(totals.totalMargin, 26.93);
});

test('article margins PDF schema accepts report filters', () => {
  const parsed = statisticsArticleMarginsQuerySchema.parse({
    dateFrom: '2026-05-01',
    dateTo: '2026-05-23',
    categoryId: '3',
    brandId: '4',
    status: 'ACTIVE',
    q: 'campera',
  });

  assert.equal(parsed.dateFrom, '2026-05-01');
  assert.equal(parsed.dateTo, '2026-05-23');
  assert.equal(parsed.categoryId, 3);
  assert.equal(parsed.brandId, 4);
  assert.equal(parsed.status, 'ACTIVE');
  assert.equal(parsed.q, 'campera');
});

test('article margins PDF schema rejects order statuses', () => {
  assert.throws(
    () => statisticsArticleMarginsQuerySchema.parse({ status: 'PENDING' }),
    /Invalid option|Invalid enum/i,
  );
});
