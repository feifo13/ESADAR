import { calculateEffectiveSalePrice } from '../articles/article-pricing-calculator.js';

export const COST_INTEGRITY_ISSUE_CODES = Object.freeze({
  MISSING_ITEM_COST: 'MISSING_ITEM_COST',
  MISSING_HISTORICAL_SNAPSHOT: 'MISSING_HISTORICAL_SNAPSHOT',
  INVALID_ITEM_COST: 'INVALID_ITEM_COST',
  INVALID_COST_COMPONENT: 'INVALID_COST_COMPONENT',
  INVALID_BANK_TAX_SNAPSHOT: 'INVALID_BANK_TAX_SNAPSHOT',
  INVALID_SALE_PRICE: 'INVALID_SALE_PRICE',
  CURRENT_COST_FALLBACK_FORBIDDEN: 'CURRENT_COST_FALLBACK_FORBIDDEN',
  UNCOMPUTABLE_PROFIT: 'UNCOMPUTABLE_PROFIT',
});

export const HISTORICAL_FINANCIAL_SNAPSHOT_FIELDS = Object.freeze([
  'finalUnitPriceSnapshot',
  'lineTotalSnapshot',
  'purchasePriceItemSnapshot',
  'purchasePriceShippingSnapshot',
  'purchasePriceCourierSnapshot',
  'purchasePriceTotalSnapshot',
  'bankTaxRateSnapshot',
  'bankTaxBaseSnapshot',
  'bankTaxSnapshot',
  'totalCostSnapshot',
  'profitSnapshot',
]);

function isMissing(value) {
  return value == null || value === '';
}

function isFiniteNumber(value) {
  return !isMissing(value) && Number.isFinite(Number(value));
}

function addIssue(issues, code) {
  if (!issues.includes(code)) issues.push(code);
}

export function evaluateCurrentArticleCostIntegrity(article = {}, options = {}) {
  const issues = [];
  if (isMissing(article.purchasePriceItem)) {
    addIssue(issues, COST_INTEGRITY_ISSUE_CODES.MISSING_ITEM_COST);
  } else if (!isFiniteNumber(article.purchasePriceItem) || Number(article.purchasePriceItem) <= 0) {
    addIssue(issues, COST_INTEGRITY_ISSUE_CODES.INVALID_ITEM_COST);
  }

  for (const field of ['purchasePriceShipping', 'purchasePriceCourier']) {
    if (!isMissing(article[field]) && (!isFiniteNumber(article[field]) || Number(article[field]) < 0)) {
      addIssue(issues, COST_INTEGRITY_ISSUE_CODES.INVALID_COST_COMPONENT);
    }
  }

  const effectiveSalePrice = calculateEffectiveSalePrice(article);
  if (!isFiniteNumber(article.salePrice) || effectiveSalePrice <= 0) {
    addIssue(issues, COST_INTEGRITY_ISSUE_CODES.INVALID_SALE_PRICE);
  }

  const bankTaxRate = options.bankTaxRate ?? article.bankTaxRate;
  if (!isMissing(bankTaxRate)
    && (!isFiniteNumber(bankTaxRate) || Number(bankTaxRate) < 0 || Number(bankTaxRate) > 1)) {
    addIssue(issues, COST_INTEGRITY_ISSUE_CODES.INVALID_BANK_TAX_SNAPSHOT);
  }

  return {
    scope: 'CURRENT_ARTICLES',
    dataQuality: issues.length ? 'INCOMPLETE' : 'COMPLETE',
    issueCodes: issues,
  };
}

export function evaluateHistoricalSaleCostIntegrity(row = {}) {
  const issues = [];
  const missingFields = HISTORICAL_FINANCIAL_SNAPSHOT_FIELDS.filter(
    (field) => isMissing(row[field]),
  );
  if (missingFields.length) {
    addIssue(issues, COST_INTEGRITY_ISSUE_CODES.MISSING_HISTORICAL_SNAPSHOT);
  }

  if (!isMissing(row.purchasePriceItemSnapshot)
    && (!isFiniteNumber(row.purchasePriceItemSnapshot)
      || Number(row.purchasePriceItemSnapshot) <= 0)) {
    addIssue(issues, COST_INTEGRITY_ISSUE_CODES.INVALID_ITEM_COST);
  }

  for (const field of ['purchasePriceShippingSnapshot', 'purchasePriceCourierSnapshot']) {
    if (!isMissing(row[field]) && (!isFiniteNumber(row[field]) || Number(row[field]) < 0)) {
      addIssue(issues, COST_INTEGRITY_ISSUE_CODES.INVALID_COST_COMPONENT);
    }
  }

  if (!isMissing(row.purchasePriceTotalSnapshot)
    && (!isFiniteNumber(row.purchasePriceTotalSnapshot)
      || Number(row.purchasePriceTotalSnapshot) < 0)) {
    addIssue(issues, COST_INTEGRITY_ISSUE_CODES.INVALID_COST_COMPONENT);
  }

  const rate = row.bankTaxRateSnapshot;
  if (!isMissing(rate) && (!isFiniteNumber(rate) || Number(rate) < 0 || Number(rate) > 1)) {
    addIssue(issues, COST_INTEGRITY_ISSUE_CODES.INVALID_BANK_TAX_SNAPSHOT);
  }

  for (const field of ['bankTaxBaseSnapshot', 'bankTaxSnapshot', 'totalCostSnapshot']) {
    if (!isMissing(row[field]) && (!isFiniteNumber(row[field]) || Number(row[field]) < 0)) {
      addIssue(issues, COST_INTEGRITY_ISSUE_CODES.INVALID_BANK_TAX_SNAPSHOT);
    }
  }

  if (!isMissing(row.finalUnitPriceSnapshot)
    && (!isFiniteNumber(row.finalUnitPriceSnapshot) || Number(row.finalUnitPriceSnapshot) <= 0)) {
    addIssue(issues, COST_INTEGRITY_ISSUE_CODES.INVALID_SALE_PRICE);
  }
  if (!isMissing(row.lineTotalSnapshot)
    && (!isFiniteNumber(row.lineTotalSnapshot) || Number(row.lineTotalSnapshot) <= 0)) {
    addIssue(issues, COST_INTEGRITY_ISSUE_CODES.INVALID_SALE_PRICE);
  }

  if (row.usesCurrentCostFallback === true
    || row.calculationSource === 'CURRENT_ARTICLE_FALLBACK') {
    addIssue(issues, COST_INTEGRITY_ISSUE_CODES.CURRENT_COST_FALLBACK_FORBIDDEN);
  }

  if (isMissing(row.profitSnapshot) || !isFiniteNumber(row.profitSnapshot)) {
    addIssue(issues, COST_INTEGRITY_ISSUE_CODES.UNCOMPUTABLE_PROFIT);
  }

  return {
    scope: 'HISTORICAL_SALES',
    dataQuality: issues.length ? 'INCOMPLETE' : 'COMPLETE',
    issueCodes: issues,
    missingFields,
  };
}
