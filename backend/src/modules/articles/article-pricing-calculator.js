export const BANK_TAX_RATE = 0.025;

function asNumber(value) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundMoney(value) {
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

export function calculateBankTax(article = {}) {
  return roundMoney(calculateBankTaxBase(article) * BANK_TAX_RATE);
}

export function calculateMinimumArticlePrice(article = {}) {
  return roundMoney(
    calculateBankTaxBase(article) +
      calculateBankTax(article) +
      asNumber(article.purchasePriceCourier),
  );
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

export function getArticlePriceValidationIssue(article = {}) {
  const salePrice = roundMoney(article.salePrice);
  const effectiveSalePrice = calculateEffectiveSalePrice(article);
  const minimumArticlePrice = calculateMinimumArticlePrice(article);

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

export function validateArticlePriceAboveCost(article = {}) {
  const issue = getArticlePriceValidationIssue(article);
  if (issue) {
    const error = new Error(issue.message);
    error.code = 'ARTICLE_PRICE_BELOW_COST';
    error.details = issue;
    throw error;
  }
  return true;
}
