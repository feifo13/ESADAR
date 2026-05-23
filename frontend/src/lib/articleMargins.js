function asNumber(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundMoney(value) {
  return Number(asNumber(value).toFixed(2));
}

export const BANK_TAX_RATE = 0.025;

export function getEffectiveSalePrice({
  salePrice,
  discountType,
  discountValue,
} = {}) {
  const basePrice = asNumber(salePrice);
  const discount = asNumber(discountValue);

  if (discountType === "PERCENT") {
    return roundMoney(Math.max(basePrice - (basePrice * discount) / 100, 0));
  }

  if (discountType === "FIXED") {
    return roundMoney(Math.max(basePrice - discount, 0));
  }

  return roundMoney(basePrice);
}

export function calculateBankTax(costItem, costUsaShipping) {
  return roundMoney((asNumber(costItem) + asNumber(costUsaShipping)) * BANK_TAX_RATE);
}

export function calculateArticleMarginPreview(article = {}) {
  const purchasePriceItem = asNumber(article.purchasePriceItem);
  const purchasePriceShipping = asNumber(article.purchasePriceShipping);
  const purchasePriceCourier = asNumber(article.purchasePriceCourier);
  const totalPurchasePrice = roundMoney(
    purchasePriceItem + purchasePriceShipping + purchasePriceCourier,
  );
  const effectiveSalePrice = getEffectiveSalePrice(article);
  const bankTax = calculateBankTax(purchasePriceItem, purchasePriceShipping);
  const totalCost = roundMoney(totalPurchasePrice + bankTax);
  const estimatedProfit = roundMoney(effectiveSalePrice - totalCost);
  const estimatedMargin = effectiveSalePrice > 0
    ? Number(((estimatedProfit / effectiveSalePrice) * 100).toFixed(2))
    : 0;

  return {
    purchasePriceItem,
    purchasePriceShipping,
    purchasePriceCourier,
    bankTax,
    totalPurchasePrice,
    totalCost,
    totalPerArticle: totalCost,
    effectiveSalePrice,
    estimatedProfit,
    estimatedMargin,
    isNegative: estimatedProfit < 0,
  };
}
