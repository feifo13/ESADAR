import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  articleCreateSchema,
  articleInventoryReturnSchema,
  articleManualSaleSchema,
} from '../src/modules/articles/articles.schemas.js';

test('manual sale and return schemas default to one and reject invalid quantities', () => {
  assert.equal(articleManualSaleSchema.parse({}).quantity, 1);
  assert.equal(articleInventoryReturnSchema.parse({ reason: 'Venta anulada' }).quantity, 1);
  assert.throws(() => articleManualSaleSchema.parse({ quantity: 0 }));
  assert.throws(() => articleManualSaleSchema.parse({ quantity: 1.5 }));
  assert.throws(() => articleInventoryReturnSchema.parse({ quantity: -1 }));
});

test('article creation accepts explicit sold-out initial state and requires positive total', () => {
  const baseArticle = {
    title: 'Campera vintage',
    salePrice: 1000,
    quantityTotal: 1,
    initialStockState: 'SOLD_OUT',
  };

  assert.equal(articleCreateSchema.parse(baseArticle).initialStockState, 'SOLD_OUT');
  assert.throws(() => articleCreateSchema.parse({ ...baseArticle, quantityTotal: 0 }));
});

test('admin article routes expose authenticated manual sale and return endpoints', async () => {
  const source = await readFile(
    new URL('../src/modules/articles/articles.routes.js', import.meta.url),
    'utf8',
  );

  assert.match(source, /adminRouter\.use\(requireAuth, requireRole\(/);
  assert.match(source, /adminRouter\.post\('\/:id\/manual-sale'/);
  assert.match(source, /adminRouter\.post\('\/:id\/return'/);
  assert.match(source, /createAdminArticleManualSale/);
  assert.match(source, /createAdminArticleInventoryReturn/);
});

test('manual sale service is transactional, audited and leaves automatic order sale wiring intact', async () => {
  const [articleSource, orderSource] = await Promise.all([
    readFile(new URL('../src/modules/articles/articles.service.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/modules/orders/orders.service.js', import.meta.url), 'utf8'),
  ]);

  assert.match(articleSource, /registerArticleManualSale[\s\S]*withTransaction/);
  assert.match(articleSource, /ARTICLE_MANUAL_SALE_REGISTERED/);
  assert.match(articleSource, /ARTICLE_INVENTORY_RETURN_REGISTERED/);
  assert.match(articleSource, /ARTICLE_HAS_ACTIVE_OFFERS/);
  assert.match(orderSource, /confirmSale\(connection/);
});

test('sold-out public pages, commerce guards, sitemap and feed remain wired to inventory', async () => {
  const [articleSource, cartSource, offerSource, seoSource] = await Promise.all([
    readFile(new URL('../src/modules/articles/articles.service.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/modules/cart/cart.service.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/modules/offers/offers.service.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/modules/seo/seo.service.js', import.meta.url), 'utf8'),
  ]);

  const publicDetailSource = articleSource.slice(
    articleSource.indexOf('export async function getPublicArticleBySlugOrId'),
    articleSource.indexOf('export async function getRelatedPublicArticles'),
  );
  assert.match(publicDetailSource, /a\.slug = \? OR a\.id = \?/);
  assert.doesNotMatch(publicDetailSource, /quantity_available\s*>\s*0/i);
  assert.match(cartSource, /requestedQuantity > Number\(article\.quantityAvailable/);
  assert.match(offerSource, /Number\(article\.quantityAvailable\) <= 0/);
  assert.match(seoSource, /WHERE a\.status = 'ACTIVE'/);
  assert.match(seoSource, /"out of stock"/);
});
