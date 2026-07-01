import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calculateBankTax,
  calculateBankTaxBase,
  calculateArticlePricing,
  calculateEffectiveSalePrice,
  calculateMinimumArticlePrice,
  getArticlePriceValidationIssue,
  validateArticlePriceAboveCost,
} from '../src/modules/articles/article-pricing-calculator.js';
import {
  articleCreateSchema,
  articleUpdateSchema,
  bulkArticleRowSchema,
} from '../src/modules/articles/articles.schemas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const baseCosts = {
  purchasePriceItem: 1000,
  purchasePriceShipping: 150,
  purchasePriceCourier: 100,
};

test('article pricing calculates bank tax only over item cost and USA shipping', () => {
  assert.equal(calculateBankTaxBase(baseCosts), 1150);
  assert.equal(calculateBankTax(baseCosts), 28.75);
  assert.equal(calculateBankTax(baseCosts, { bankTaxRate: 0.03 }), 34.5);
  assert.equal(
    calculateBankTax({ ...baseCosts, purchasePriceCourier: 900 }),
    28.75,
  );
});

test('article pricing calculates minimum total article price', () => {
  assert.equal(calculateMinimumArticlePrice(baseCosts), 1278.75);
  const metrics = calculateArticlePricing(baseCosts);
  assert.equal(metrics.purchasePriceTotal, 1250);
  assert.equal(metrics.bankTaxBase, 1150);
  assert.equal(metrics.bankTax, 28.75);
  assert.equal(metrics.totalCost, 1278.75);
});

test('article pricing rejects sale price below cost and accepts exact cost', () => {
  assert.equal(
    getArticlePriceValidationIssue({ ...baseCosts, salePrice: 1278.74 })?.reason,
    'salePrice',
  );

  assert.doesNotThrow(() =>
    validateArticlePriceAboveCost({ ...baseCosts, salePrice: 1278.75 }),
  );
});

test('article pricing rejects fixed discount below minimum cost', () => {
  const article = {
    ...baseCosts,
    salePrice: 2000,
    discountType: 'FIXED',
    discountValue: 800,
  };

  assert.equal(calculateEffectiveSalePrice(article), 1200);
  assert.equal(getArticlePriceValidationIssue(article)?.reason, 'discount');
});

test('article pricing rejects percentage discount below minimum cost', () => {
  const article = {
    ...baseCosts,
    salePrice: 1600,
    discountType: 'PERCENT',
    discountValue: 25,
  };

  assert.equal(calculateEffectiveSalePrice(article), 1200);
  assert.equal(getArticlePriceValidationIssue(article)?.reason, 'discount');
});

test('article create, update and bulk schemas leave configurable cost validation to services', () => {
  assert.doesNotThrow(
    () => articleCreateSchema.parse({
      title: 'Campera test',
      ...baseCosts,
      salePrice: 1200,
    }),
  );

  assert.doesNotThrow(
    () => articleUpdateSchema.parse({
      ...baseCosts,
      salePrice: 2000,
      discountType: 'FIXED',
      discountValue: 800,
    }),
  );

  assert.doesNotThrow(
    () => bulkArticleRowSchema.parse({
      title: 'Campera lote',
      ...baseCosts,
      salePrice: 1200,
    }),
  );
});

test('article service validates the merged payload for partial updates', () => {
  const source = readFileSync(
    resolve(__dirname, '../src/modules/articles/articles.service.js'),
    'utf8',
  );

  assert.match(source, /\.\.\.before,\s*\n\s*\.\.\.input/);
  assert.match(source, /getCostingSettings\(connection\)/);
  assert.match(source, /getArticlePriceValidationIssue\(payload,\s*\{ bankTaxRate \}\)/);
  assert.match(source, /ARTICLE_PRICE_BELOW_COST/);
});
