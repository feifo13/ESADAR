import test from 'node:test';
import assert from 'node:assert/strict';
import { fillMissingSalesPeriods } from '../src/modules/statistics/statistics.service.js';

test('fills missing daily sales periods inside an explicit date range', () => {
  const items = [
    {
      periodLabel: '2026-05-02',
      ordersCount: 1,
      itemsSold: 2,
      revenue: 1200,
      bankTax: 0,
      totalCost: 0,
      estimatedProfit: 600,
      averageMargin: 50,
      total: 1200,
    },
  ];

  const result = fillMissingSalesPeriods(
    items,
    { dateFrom: '2026-05-01', dateTo: '2026-05-03' },
    'day',
  );

  assert.deepEqual(
    result.map((item) => item.periodLabel),
    ['2026-05-01', '2026-05-02', '2026-05-03'],
  );
  assert.equal(result[0].revenue, 0);
  assert.equal(result[1].revenue, 1200);
  assert.equal(result[2].ordersCount, 0);
});

test('fills missing weekly sales periods using ISO week labels', () => {
  const result = fillMissingSalesPeriods(
    [{ ...buildSalesPeriod('2026-W02'), revenue: 900 }],
    { dateFrom: '2025-12-29', dateTo: '2026-01-11' },
    'week',
  );

  assert.deepEqual(
    result.map((item) => item.periodLabel),
    ['2026-W01', '2026-W02'],
  );
  assert.equal(result[0].revenue, 0);
  assert.equal(result[1].revenue, 900);
});

test('fills missing monthly sales periods inside an explicit date range', () => {
  const result = fillMissingSalesPeriods(
    [{ ...buildSalesPeriod('2026-02'), revenue: 2500 }],
    { dateFrom: '2026-01-15', dateTo: '2026-03-20' },
    'month',
  );

  assert.deepEqual(
    result.map((item) => item.periodLabel),
    ['2026-01', '2026-02', '2026-03'],
  );
  assert.equal(result[0].revenue, 0);
  assert.equal(result[1].revenue, 2500);
  assert.equal(result[2].revenue, 0);
});

function buildSalesPeriod(periodLabel) {
  return {
    periodLabel,
    ordersCount: 0,
    itemsSold: 0,
    revenue: 0,
    bankTax: 0,
    totalCost: 0,
    estimatedProfit: 0,
    averageMargin: 0,
    total: 0,
  };
}
