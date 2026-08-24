import { calculateArticlePricing } from './article-pricing-calculator.js';

function asNumber(value) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundMoney(value) {
  return Number(asNumber(value).toFixed(2));
}

function roundPercent(value) {
  return Number(asNumber(value).toFixed(2));
}

function formatExportDate(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function getDiscountTypeLabel(value) {
  const type = String(value || 'NONE').toUpperCase();
  if (type === 'PERCENT') return 'Porcentaje';
  if (type === 'FIXED') return 'Monto fijo';
  return 'Sin descuento';
}

export function getArticleFinancialResult(estimatedProfit) {
  const cents = Math.round(asNumber(estimatedProfit) * 100);
  if (cents > 0) return 'Ganancia';
  if (cents < 0) return 'Pérdida';
  return 'Equilibrio';
}

function getArticleSizeLabel(row) {
  return row.sizeCode || row.sizeText || row.size?.code || '';
}

export function buildArticleFinancialProjectionRows(rows, costingSettings) {
  return (rows || []).map((row) => {
    const metrics = calculateArticlePricing(row, {
      bankTaxRate: costingSettings.bankTaxRate,
    });

    return {
      lotCode: row.lotCode || '',
      lotName: row.lotName || '',
      lotStatus: row.lotStatus || '',
      internalCode: row.internalCode || '',
      title: row.title || '',
      status: row.status || row.publicationStatus || '',
      categoryName: row.categoryName || row.category?.name || '',
      brandName: row.brandName || row.brand?.name || '',
      sizeLabel: getArticleSizeLabel(row),
      intakeDate: formatExportDate(row.intakeDate),
      quantityTotal: asNumber(row.quantityTotal),
      quantityAvailable: asNumber(row.quantityAvailable),
      quantityReserved: asNumber(row.quantityReserved),
      quantitySold: asNumber(row.quantitySold),
      salePrice: metrics.salePrice,
      discountType: getDiscountTypeLabel(row.discountType),
      discountValue: asNumber(row.discountValue),
      effectiveSalePrice: metrics.effectiveSalePrice,
      purchasePriceItem: metrics.purchasePriceItem,
      purchasePriceShipping: metrics.purchasePriceShipping,
      purchasePriceCourier: metrics.purchasePriceCourier,
      purchasePriceTotal: metrics.purchasePriceTotal,
      bankTaxBase: metrics.bankTaxBase,
      bankTaxPercent: metrics.bankTaxPercent,
      bankTax: metrics.bankTax,
      totalCost: metrics.totalCost,
      estimatedProfit: metrics.estimatedProfit,
      estimatedMargin: metrics.estimatedMargin,
      result: getArticleFinancialResult(metrics.estimatedProfit),
    };
  });
}

export function calculateArticleFinancialProjectionTotals(rows) {
  const totals = (rows || []).reduce(
    (accumulator, row) => {
      const estimatedProfit = asNumber(row.estimatedProfit);
      accumulator.articleCount += 1;
      accumulator.stockTotal += asNumber(row.quantityTotal);
      accumulator.stockAvailable += asNumber(row.quantityAvailable);
      accumulator.stockReserved += asNumber(row.quantityReserved);
      accumulator.stockSold += asNumber(row.quantitySold);
      accumulator.totalSalePrice += asNumber(row.salePrice);
      accumulator.totalEffectiveSalePrice += asNumber(row.effectiveSalePrice);
      accumulator.totalPurchasePriceItem += asNumber(row.purchasePriceItem);
      accumulator.totalPurchasePriceShipping += asNumber(row.purchasePriceShipping);
      accumulator.totalPurchasePriceCourier += asNumber(row.purchasePriceCourier);
      accumulator.totalPurchasePrice += asNumber(row.purchasePriceTotal);
      accumulator.totalBankTaxBase += asNumber(row.bankTaxBase);
      accumulator.totalBankTax += asNumber(row.bankTax);
      accumulator.totalCost += asNumber(row.totalCost);
      accumulator.totalEstimatedProfit += estimatedProfit;

      const result = getArticleFinancialResult(estimatedProfit);
      if (result === 'Ganancia') accumulator.profitCount += 1;
      if (result === 'Pérdida') accumulator.lossCount += 1;
      if (result === 'Equilibrio') accumulator.breakEvenCount += 1;
      return accumulator;
    },
    {
      articleCount: 0,
      stockTotal: 0,
      stockAvailable: 0,
      stockReserved: 0,
      stockSold: 0,
      totalSalePrice: 0,
      totalEffectiveSalePrice: 0,
      totalPurchasePriceItem: 0,
      totalPurchasePriceShipping: 0,
      totalPurchasePriceCourier: 0,
      totalPurchasePrice: 0,
      totalBankTaxBase: 0,
      totalBankTax: 0,
      totalCost: 0,
      totalEstimatedProfit: 0,
      profitCount: 0,
      lossCount: 0,
      breakEvenCount: 0,
    },
  );

  return {
    articleCount: totals.articleCount,
    stockTotal: totals.stockTotal,
    stockAvailable: totals.stockAvailable,
    stockReserved: totals.stockReserved,
    stockSold: totals.stockSold,
    totalSalePrice: roundMoney(totals.totalSalePrice),
    totalEffectiveSalePrice: roundMoney(totals.totalEffectiveSalePrice),
    totalPurchasePriceItem: roundMoney(totals.totalPurchasePriceItem),
    totalPurchasePriceShipping: roundMoney(totals.totalPurchasePriceShipping),
    totalPurchasePriceCourier: roundMoney(totals.totalPurchasePriceCourier),
    totalPurchasePrice: roundMoney(totals.totalPurchasePrice),
    totalBankTaxBase: roundMoney(totals.totalBankTaxBase),
    totalBankTax: roundMoney(totals.totalBankTax),
    totalCost: roundMoney(totals.totalCost),
    totalEstimatedProfit: roundMoney(totals.totalEstimatedProfit),
    weightedMargin: totals.totalEffectiveSalePrice > 0
      ? roundPercent((totals.totalEstimatedProfit / totals.totalEffectiveSalePrice) * 100)
      : 0,
    profitCount: totals.profitCount,
    lossCount: totals.lossCount,
    breakEvenCount: totals.breakEvenCount,
  };
}

export function buildArticleProfitProjectionSummary(projectionRows) {
  const totals = calculateArticleFinancialProjectionTotals(projectionRows);
  return {
    articleCount: totals.articleCount,
    totalSalePrice: totals.totalSalePrice,
    totalEffectiveSalePrice: totals.totalEffectiveSalePrice,
    totalPurchasePriceItem: totals.totalPurchasePriceItem,
    totalPurchasePriceShipping: totals.totalPurchasePriceShipping,
    totalPurchasePriceCourier: totals.totalPurchasePriceCourier,
    totalPurchasePrice: totals.totalPurchasePrice,
    totalBankTaxBase: totals.totalBankTaxBase,
    totalBankTax: totals.totalBankTax,
    totalCost: totals.totalCost,
    totalEstimatedProfit: totals.totalEstimatedProfit,
    weightedMargin: totals.weightedMargin,
    profitCount: totals.profitCount,
    lossCount: totals.lossCount,
    breakEvenCount: totals.breakEvenCount,
  };
}

export function buildArticleLotFinancialSummary(rows, costingSettings) {
  const projectionRows = buildArticleFinancialProjectionRows(rows, costingSettings);
  const totals = calculateArticleFinancialProjectionTotals(projectionRows);
  return {
    articleCount: totals.articleCount,
    stockTotal: totals.stockTotal,
    stockAvailable: totals.stockAvailable,
    stockReserved: totals.stockReserved,
    stockSold: totals.stockSold,
    totalSalePrice: totals.totalSalePrice,
    totalEffectiveSalePrice: totals.totalEffectiveSalePrice,
    totalPurchasePriceItem: totals.totalPurchasePriceItem,
    totalPurchasePriceShipping: totals.totalPurchasePriceShipping,
    totalPurchasePriceCourier: totals.totalPurchasePriceCourier,
    totalPurchasePriceTotal: totals.totalPurchasePrice,
    totalBankTaxBase: totals.totalBankTaxBase,
    totalBankTax: totals.totalBankTax,
    totalCost: totals.totalCost,
    totalEstimatedProfit: totals.totalEstimatedProfit,
    weightedEstimatedMargin: totals.weightedMargin,
    profitCount: totals.profitCount,
    lossCount: totals.lossCount,
    breakEvenCount: totals.breakEvenCount,
  };
}
