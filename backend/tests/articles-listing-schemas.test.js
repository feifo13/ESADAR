import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adminArticleListQuerySchema,
  publicArticleListQuerySchema,
  publicRelatedArticlesQuerySchema,
} from '../src/modules/articles/articles.schemas.js';

test('public article query sanitizes normal filters, pagination and search', () => {
  const parsed = publicArticleListQuerySchema.parse({
    search: '  campera nike  ',
    categoryId: '3',
    brandId: '4',
    featured: 'true',
    discounted: '0',
    offerable: 'sí',
    sort: 'price_asc',
    page: '2',
    pageSize: '12',
  });

  assert.deepEqual(parsed, {
    search: 'campera nike',
    categoryId: 3,
    brandId: 4,
    featured: true,
    discounted: false,
    offerable: true,
    sort: 'price_asc',
    page: 2,
    pageSize: 12,
  });
});

test('public article query rejects unsafe enum, pagination and id inputs', () => {
  assert.throws(
    () => publicArticleListQuerySchema.parse({ sort: 'price_asc; DROP TABLE articles;' }),
    /Invalid option/,
  );
  assert.throws(
    () => publicArticleListQuerySchema.parse({ page: '1 OR 1=1' }),
    /Invalid input/,
  );
  assert.throws(
    () => publicArticleListQuerySchema.parse({ brandId: '4;DROP TABLE brands;' }),
    /Invalid input/,
  );
});

test('admin article query only accepts whitelisted sort fields and direction', () => {
  const parsed = adminArticleListQuerySchema.parse({
    search: 'adidas',
    status: 'ACTIVE',
    sortBy: 'updatedAt',
    sortDir: 'asc',
    page: '1',
    pageSize: '25',
  });

  assert.equal(parsed.search, 'adidas');
  assert.equal(parsed.status, 'ACTIVE');
  assert.equal(parsed.sortBy, 'updatedAt');
  assert.equal(parsed.sortDir, 'asc');
  assert.equal(parsed.page, 1);
  assert.equal(parsed.pageSize, 25);

  assert.throws(
    () => adminArticleListQuerySchema.parse({ sortBy: 'updatedAt; DROP TABLE users;' }),
    /Invalid option/,
  );
  assert.throws(
    () => adminArticleListQuerySchema.parse({ sortDir: 'desc; DROP TABLE users;' }),
    /Invalid option/,
  );
});

test('related articles limit is bounded', () => {
  assert.equal(publicRelatedArticlesQuerySchema.parse({ limit: '6' }).limit, 6);
  assert.throws(
    () => publicRelatedArticlesQuerySchema.parse({ limit: '999' }),
    /Too big/,
  );
});
