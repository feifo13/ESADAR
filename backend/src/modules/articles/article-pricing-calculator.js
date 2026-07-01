export const DEFAULT_BANK_TAX_RATE = 0.025;
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

function toCents(value) {
  return Math.round(roundMoney(value) * 100);
}

function formatMinimumPrice(value) {
  return `$ ${new Intl.NumberFormat('es-UY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(asNumber(value))}`;
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
  return roundPercent(normalizeBankTaxRate(value) * 100);
}

function resolveBankTaxRate(article = {}, options = {}) {
  return normalizeBankTaxRate(
    options.bankTaxRate ?? article.bankTaxRate ?? DEFAULT_BANK_TAX_RATE,
  );
}

export function calculateBankTax(article = {}, options = {}) {
  const bankTaxRate = resolveBankTaxRate(article, options);
  return roundMoney(calculateBankTaxBase(article) * bankTaxRate);
}

export function calculatePurchasePriceTotal(article = {}) {
  return roundMoney(
    asNumber(article.purchasePriceItem) +
      asNumber(article.purchasePriceShipping) +
      asNumber(article.purchasePriceCourier),
  );
}

export function calculateMinimumArticlePrice(article = {}, options = {}) {
  return roundMoney(calculatePurchasePriceTotal(article) + calculateBankTax(article, options));
}

export function calculateEffectiveSalePrice({
  salePrice,
  discountType,
  discountValue,
} = {}) {
  const basePrice = asNumber(salePrice);
  const discount = asNumber(discountValue);
  const type = String(discountType || 'NONE').trim().toUpperCase();

  if (type === 'PERCENT') {
    return roundMoney(Math.max(basePrice - (basePrice * discount) / 100, 0));
  }

  if (type === 'FIXED') {
    return roundMoney(Math.max(basePrice - discount, 0));
  }

  return roundMoney(basePrice);
}

export function calculateArticlePricing(article = {}, options = {}) {
  const salePrice = roundMoney(article.salePrice);
  const effectiveSalePrice = calculateEffectiveSalePrice(article);
  const purchasePriceItem = roundMoney(article.purchasePriceItem);
  const purchasePriceShipping = roundMoney(article.purchasePriceShipping);
  const purchasePriceCourier = roundMoney(article.purchasePriceCourier);
  const bankTaxRate = resolveBankTaxRate(article, options);
  const bankTaxBase = calculateBankTaxBase({
    purchasePriceItem,
    purchasePriceShipping,
  });
  const bankTax = calculateBankTax(
    {
      purchasePriceItem,
      purchasePriceShipping,
    },
    { bankTaxRate },
  );
  const purchasePriceTotal = calculatePurchasePriceTotal({
    purchasePriceItem,
    purchasePriceShipping,
    purchasePriceCourier,
  });
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
    purchasePriceTotal,
    totalPurchasePrice: purchasePriceTotal,
    bankTaxBase,
    bankTaxRate,
    bankTaxPercent: bankTaxRateToPercent(bankTaxRate),
    bankTax,
    totalCost,
    minimumArticlePrice: totalCost,
    totalPerArticle: totalCost,
    estimatedProfit,
    estimatedMargin,
    isNegative: estimatedProfit < 0,
  };
}

export function getArticlePriceValidationIssue(article = {}, options = {}) {
  const salePrice = roundMoney(article.salePrice);
  const effectiveSalePrice = calculateEffectiveSalePrice(article);
  const minimumArticlePrice = calculateMinimumArticlePrice(article, options);

  if (toCents(salePrice) < toCents(minimumArticlePrice)) {
    return {
      reason: 'salePrice',
      path: ['salePrice'],
      message: `El precio de venta no puede ser menor al costo total mínimo del artículo (${formatMinimumPrice(minimumArticlePrice)}).`,
      salePrice,
      effectiveSalePrice,
      minimumArticlePrice,
    };
  }

  if (toCents(effectiveSalePrice) < toCents(minimumArticlePrice)) {
    return {
      reason: 'discount',
      path: ['discountValue'],
      message: `El precio final con descuento no puede quedar por debajo del costo total mínimo del artículo (${formatMinimumPrice(minimumArticlePrice)}).`,
      salePrice,
      effectiveSalePrice,
      minimumArticlePrice,
    };
  }

  return null;
}

export function validateArticlePriceAboveCost(article = {}, options = {}) {
  const issue = getArticlePriceValidationIssue(article, options);
  if (issue) {
    const error = new Error(issue.message);
    error.code = 'ARTICLE_PRICE_BELOW_COST';
    error.details = issue;
    throw error;
  }
  return true;
}
