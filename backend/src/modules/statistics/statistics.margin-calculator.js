import {
  DEFAULT_BANK_TAX_RATE,
  calculateArticlePricing,
  calculateBankTax as calculateArticleBankTax,
  calculateBankTaxBase,
  calculateEffectiveSalePrice,
  normalizeBankTaxRate,
} from '../articles/article-pricing-calculator.js';

export const BANK_TAX_RATE = DEFAULT_BANK_TAX_RATE;

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

export { calculateEffectiveSalePrice };

export function calculateBankTax(costItem, costUsaShipping, options = {}) {
  const bankTaxRate = normalizeBankTaxRate(options.bankTaxRate ?? BANK_TAX_RATE);
  return calculateArticleBankTax({
    purchasePriceItem: costItem,
    purchasePriceShipping: costUsaShipping,
  }, { bankTaxRate });
}

export function calculateArticleMargin(article = {}, options = {}) {
  return calculateArticlePricing(article, options);
}

export function calculateTotals(rows = []) {
  const totals = rows.reduce(
    (accumulator, row) => ({
      articleCount: accumulator.articleCount + 1,
      totalSalePrice: accumulator.totalSalePrice + asNumber(row.salePrice),
      totalEffectiveSalePrice: accumulator.totalEffectiveSalePrice + asNumber(row.effectiveSalePrice),
      totalPurchasePriceItem: accumulator.totalPurchasePriceItem + asNumber(row.purchasePriceItem),
      totalPurchasePriceShipping: accumulator.totalPurchasePriceShipping + asNumber(row.purchasePriceShipping),
      totalPurchasePriceCourier: accumulator.totalPurchasePriceCourier + asNumber(row.purchasePriceCourier),
      totalBankTaxBase: accumulator.totalBankTaxBase + asNumber(row.bankTaxBase ?? calculateBankTaxBase(row)),
      totalBankTax: accumulator.totalBankTax + asNumber(row.bankTax),
      totalPurchasePrice: accumulator.totalPurchasePrice + asNumber(row.purchasePriceTotal),
      totalCost: accumulator.totalCost + asNumber(row.totalCost),
      totalPerArticle: accumulator.totalPerArticle + asNumber(row.totalPerArticle),
      totalEstimatedProfit: accumulator.totalEstimatedProfit + asNumber(row.estimatedProfit),
    }),
    {
      articleCount: 0,
      totalSalePrice: 0,
      totalEffectiveSalePrice: 0,
      totalPurchasePriceItem: 0,
      totalPurchasePriceShipping: 0,
      totalPurchasePriceCourier: 0,
      totalBankTaxBase: 0,
      totalBankTax: 0,
      totalPurchasePrice: 0,
      totalCost: 0,
      totalPerArticle: 0,
      totalEstimatedProfit: 0,
    },
  );

  return {
    ...totals,
    totalSalePrice: roundMoney(totals.totalSalePrice),
    totalEffectiveSalePrice: roundMoney(totals.totalEffectiveSalePrice),
    totalPurchasePriceItem: roundMoney(totals.totalPurchasePriceItem),
    totalPurchasePriceShipping: roundMoney(totals.totalPurchasePriceShipping),
    totalPurchasePriceCourier: roundMoney(totals.totalPurchasePriceCourier),
    totalBankTaxBase: roundMoney(totals.totalBankTaxBase),
    totalBankTax: roundMoney(totals.totalBankTax),
    totalPurchasePrice: roundMoney(totals.totalPurchasePrice),
    totalCost: roundMoney(totals.totalCost),
    totalPerArticle: roundMoney(totals.totalPerArticle),
    totalEstimatedProfit: roundMoney(totals.totalEstimatedProfit),
    totalMargin: totals.totalEffectiveSalePrice > 0
      ? roundPercent((totals.totalEstimatedProfit / totals.totalEffectiveSalePrice) * 100)
      : 0,
  };
}
