function asNumber(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundMoney(value) {
  return Number(asNumber(value).toFixed(2));
}

export const DEFAULT_BANK_TAX_RATE = 0.025;
export const BANK_TAX_RATE = DEFAULT_BANK_TAX_RATE;

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

export function normalizeBankTaxRate(value = DEFAULT_BANK_TAX_RATE) {
  const numeric = asNumber(value);
  if (numeric < 0) return 0;
  if (numeric > 1) return 1;
  return numeric;
}

export function bankTaxRateToPercent(value = DEFAULT_BANK_TAX_RATE) {
  return Number((normalizeBankTaxRate(value) * 100).toFixed(2));
}

function resolveBankTaxRate(article = {}, options = {}) {
  return normalizeBankTaxRate(
    options.bankTaxRate ?? article.bankTaxRate ?? DEFAULT_BANK_TAX_RATE,
  );
}

export function calculateBankTax(articleOrCostItem = {}, costUsaShipping = 0, options = {}) {
  if (typeof articleOrCostItem === "object" && articleOrCostItem !== null) {
    const resolvedOptions =
      costUsaShipping && typeof costUsaShipping === "object"
        ? costUsaShipping
        : options;
    return roundMoney(calculateBankTaxBase(articleOrCostItem) * resolveBankTaxRate(articleOrCostItem, resolvedOptions));
  }

  return roundMoney(
    (asNumber(articleOrCostItem) + asNumber(costUsaShipping)) * resolveBankTaxRate({}, options),
  );
}

export function calculatePurchasePriceTotal(article = {}) {
  return roundMoney(
    asNumber(article.purchasePriceItem) +
      asNumber(article.purchasePriceShipping) +
      asNumber(article.purchasePriceCourier),
  );
}

export function calculateMinimumArticlePrice(article = {}, options = {}) {
  return roundMoney(calculatePurchasePriceTotal(article) + calculateBankTax(article, 0, options));
}

export function getArticlePriceValidationIssue(article = {}, options = {}) {
  const salePrice = roundMoney(article.salePrice);
  const effectiveSalePrice = getEffectiveSalePrice(article);
  const minimumArticlePrice = calculateMinimumArticlePrice(article, options);

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

export function calculateArticleMarginPreview(article = {}, options = {}) {
  const purchasePriceItem = asNumber(article.purchasePriceItem);
  const purchasePriceShipping = asNumber(article.purchasePriceShipping);
  const purchasePriceCourier = asNumber(article.purchasePriceCourier);
  const salePrice = asNumber(article.salePrice);
  const bankTaxRate = resolveBankTaxRate(article, options);
  const bankTaxBase = calculateBankTaxBase(article);
  const totalPurchasePrice = calculatePurchasePriceTotal(article);
  const effectiveSalePrice = getEffectiveSalePrice(article);
  const bankTax = calculateBankTax(article, 0, { bankTaxRate });
  const totalCost = calculateMinimumArticlePrice(article, { bankTaxRate });
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
    bankTaxRate,
    bankTaxPercent: bankTaxRateToPercent(bankTaxRate),
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
