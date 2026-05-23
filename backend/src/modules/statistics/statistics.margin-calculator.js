export const BANK_TAX_RATE = 0.025;

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

export function calculateEffectiveSalePrice({
  salePrice,
  discountType,
  discountValue,
} = {}) {
  const basePrice = asNumber(salePrice);
  const discount = asNumber(discountValue);
  const type = String(discountType || 'NONE').toUpperCase();

  if (type === 'PERCENT') {
    return roundMoney(Math.max(basePrice - (basePrice * discount) / 100, 0));
  }

  if (type === 'FIXED') {
    return roundMoney(Math.max(basePrice - discount, 0));
  }

  return roundMoney(basePrice);
}

export function calculateBankTax(costItem, costUsaShipping) {
  return roundMoney((asNumber(costItem) + asNumber(costUsaShipping)) * BANK_TAX_RATE);
}

export function calculateArticleMargin(article = {}) {
  const salePrice = roundMoney(article.salePrice);
  const effectiveSalePrice = calculateEffectiveSalePrice(article);
  const purchasePriceItem = roundMoney(article.purchasePriceItem);
  const purchasePriceShipping = roundMoney(article.purchasePriceShipping);
  const purchasePriceCourier = roundMoney(article.purchasePriceCourier);
  const purchasePriceTotal = roundMoney(
    purchasePriceItem + purchasePriceShipping + purchasePriceCourier,
  );
  const bankTax = calculateBankTax(purchasePriceItem, purchasePriceShipping);
  const totalCost = roundMoney(purchasePriceTotal + bankTax);
  const estimatedProfit = roundMoney(effectiveSalePrice - totalCost);
  const estimatedMargin = effectiveSalePrice > 0
    ? roundPercent((estimatedProfit / effectiveSalePrice) * 100)
    : 0;

  return {
    salePrice,
    effectiveSalePrice,
    purchasePriceItem,
    purchasePriceShipping,
    purchasePriceCourier,
    bankTax,
    purchasePriceTotal,
    totalCost,
    totalPerArticle: totalCost,
    estimatedProfit,
    estimatedMargin,
  };
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
