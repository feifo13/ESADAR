import test from 'node:test';
import assert from 'node:assert/strict';
import {
  articleLotStatusSchema,
  articleLotWriteSchema,
} from '../src/modules/article-lots/article-lots.schemas.js';
import { adminArticleBatchActionSchema, articleCreateSchema } from '../src/modules/articles/articles.schemas.js';

test('articleLotWriteSchema requires code and name', () => {
  assert.equal(articleLotWriteSchema.safeParse({ code: '', name: '' }).success, false);

  const parsed = articleLotWriteSchema.parse({
    code: 'lote-test',
    name: 'Lote test',
  });

  assert.equal(parsed.code, 'LOTE-TEST');
  assert.equal(parsed.name, 'Lote test');
  assert.equal(parsed.status, 'OPEN');
});

test('articleLotStatusSchema accepts only valid statuses', () => {
  assert.equal(articleLotStatusSchema.safeParse({ status: 'OPEN' }).success, true);
  assert.equal(articleLotStatusSchema.safeParse({ status: 'CLOSED' }).success, true);
  assert.equal(articleLotStatusSchema.safeParse({ status: 'ARCHIVED' }).success, true);
  assert.equal(articleLotStatusSchema.safeParse({ status: 'DELETED' }).success, false);
});

test('articleCreateSchema accepts lotId', () => {
  const parsed = articleCreateSchema.parse({
    lotId: 1,
    title: 'Articulo test',
    salePrice: 100,
    categoryId: 1,
  });

  assert.equal(parsed.lotId, 1);
});

test('adminArticleBatchActionSchema requires lotId for ASSIGN_LOT', () => {
  assert.equal(
    adminArticleBatchActionSchema.safeParse({ action: 'ASSIGN_LOT', ids: [1] }).success,
    false,
  );
  assert.deepEqual(
    adminArticleBatchActionSchema.parse({ action: 'ASSIGN_LOT', lotId: 2, ids: [1, 1] }),
    { action: 'ASSIGN_LOT', lotId: 2, ids: [1] },
  );
});
