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

export function calculateBankTaxBase({
  purchasePriceItem,
  purchasePriceShipping,
} = {}) {
  return roundMoney(asNumber(purchasePriceItem) + asNumber(purchasePriceShipping));
}

export function calculateBankTax(articleOrCostItem = {}, costUsaShipping = 0) {
  if (typeof articleOrCostItem === "object" && articleOrCostItem !== null) {
    return roundMoney(calculateBankTaxBase(articleOrCostItem) * BANK_TAX_RATE);
  }

  return roundMoney(
    (asNumber(articleOrCostItem) + asNumber(costUsaShipping)) * BANK_TAX_RATE,
  );
}

export function calculateMinimumArticlePrice(article = {}) {
  return roundMoney(
    calculateBankTaxBase(article) +
      calculateBankTax(article) +
      asNumber(article.purchasePriceCourier),
  );
}

export function getArticlePriceValidationIssue(article = {}) {
  const salePrice = roundMoney(article.salePrice);
  const effectiveSalePrice = getEffectiveSalePrice(article);
  const minimumArticlePrice = calculateMinimumArticlePrice(article);

  if (salePrice < minimumArticlePrice) {
    return {
      reason: "salePrice",
      target: "article-sale-price",
      message: `El precio de venta no puede ser menor al costo total mínimo del artículo (${formatMinimumPrice(minimumArticlePrice)}).`,
      minimumArticlePrice,
      salePrice,
      effectiveSalePrice,
    };
  }

  if (effectiveSalePrice < minimumArticlePrice) {
    return {
      reason: "discount",
      target: "article-discount-value",
      message: `El precio final con descuento no puede quedar por debajo del costo total mínimo del artículo (${formatMinimumPrice(minimumArticlePrice)}).`,
      minimumArticlePrice,
      salePrice,
      effectiveSalePrice,
    };
  }

  return null;
}

function formatMinimumPrice(value) {
  return `$ ${new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(asNumber(value))}`;
}

export function calculateArticleMarginPreview(article = {}) {
  const purchasePriceItem = asNumber(article.purchasePriceItem);
  const purchasePriceShipping = asNumber(article.purchasePriceShipping);
  const purchasePriceCourier = asNumber(article.purchasePriceCourier);
  const salePrice = asNumber(article.salePrice);
  const bankTaxBase = calculateBankTaxBase(article);
  const totalPurchasePrice = roundMoney(
    purchasePriceItem + purchasePriceShipping + purchasePriceCourier,
  );
  const effectiveSalePrice = getEffectiveSalePrice(article);
  const bankTax = calculateBankTax(article);
  const totalCost = calculateMinimumArticlePrice(article);
  const estimatedProfit = roundMoney(effectiveSalePrice - totalCost);
  const estimatedMargin = effectiveSalePrice > 0
    ? Number(((estimatedProfit / effectiveSalePrice) * 100).toFixed(2))
    : 0;

  return {
    purchasePriceItem,
    purchasePriceShipping,
    purchasePriceCourier,
    salePrice,
    bankTaxBase,
    bankTax,
    totalPurchasePrice,
    totalCost,
    minimumArticlePrice: totalCost,
    totalPerArticle: totalCost,
    effectiveSalePrice,
    estimatedProfit,
    estimatedMargin,
    isNegative: estimatedProfit < 0,
  };
}
