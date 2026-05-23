import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildLikeValue,
  optionalSortField,
  resolveSortClause,
  sortDirSchema,
  sortFieldSchema,
} from '../src/utils/listing.js';
import { getPagination } from '../src/utils/pagination.js';
import {
  buildSqlLimitClause,
  buildSqlLimitOffsetClause,
  normalizeSqlLimit,
  normalizeSqlOffset,
  resolveAllowedSqlIdentifier,
} from '../src/utils/sql-safety.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('buildLikeValue keeps search as a prepared-statement value', () => {
  assert.equal(buildLikeValue('  nike  '), '%nike%');
  assert.equal(buildLikeValue("' OR '1'='1"), "%' OR '1'='1%");
});

test('SQL LIMIT/OFFSET helpers only emit sane integer literals', () => {
  assert.equal(normalizeSqlLimit('12', 25, 100), 12);
  assert.equal(normalizeSqlLimit('999', 25, 100), 100);
  assert.equal(normalizeSqlLimit('12; DROP TABLE users;', 25, 100), 25);
  assert.equal(normalizeSqlLimit('0x10', 25, 100), 25);
  assert.equal(normalizeSqlOffset('40'), 40);
  assert.equal(normalizeSqlOffset('-1'), 0);
  assert.equal(normalizeSqlOffset('0 OR 1=1'), 0);
  assert.equal(normalizeSqlOffset('999999999'), 1_000_000);
  assert.equal(buildSqlLimitClause('5', 25, 100), 'LIMIT 5');
  assert.equal(buildSqlLimitOffsetClause('20', '10', 25, 100), 'LIMIT 20 OFFSET 10');
});

test('sort and SQL identifier helpers fall back or reject unsafe values', () => {
  const sortMap = {
    title: (direction) => `ORDER BY title ${direction}`,
    createdAt: (direction) => `ORDER BY created_at ${direction}`,
  };

  assert.equal(
    resolveSortClause({ sortBy: 'title', sortDir: 'asc', sortMap, fallbackKey: 'createdAt' }),
    'ORDER BY title ASC',
  );
  assert.equal(
    resolveSortClause({ sortBy: 'title;DROP TABLE users;', sortDir: 'desc', sortMap, fallbackKey: 'createdAt' }),
    'ORDER BY created_at DESC',
  );

  assert.equal(
    resolveAllowedSqlIdentifier('brand', { brand: 'b.id', size: 's.id' }, 'lookup'),
    'b.id',
  );
  assert.throws(
    () => resolveAllowedSqlIdentifier('brand;DROP TABLE users;', { brand: 'b.id' }, 'lookup'),
    /lookup no permitido/,
  );
});

test('sort schemas default invalid sort fields and directions safely', () => {
  const optionalSort = optionalSortField(['createdAt', 'name']);
  const defaultedSort = sortFieldSchema(['createdAt', 'name'], 'createdAt');

  assert.equal(optionalSort.parse('name'), 'name');
  assert.equal(optionalSort.parse('name; DROP TABLE users;'), undefined);
  assert.equal(defaultedSort.parse('name; DROP TABLE users;'), 'createdAt');
  assert.equal(sortDirSchema.parse('asc'), 'asc');
  assert.equal(sortDirSchema.parse('desc; DROP TABLE users;'), 'desc');
});

test('pagination helper normalizes page, pageSize and offset bounds', () => {
  assert.deepEqual(getPagination({ page: '2', pageSize: '12' }), {
    page: 2,
    pageSize: 12,
    offset: 12,
    limit: 12,
  });
  assert.deepEqual(getPagination({ page: 'abc', pageSize: '10000' }, { pageSize: 25 }), {
    page: 1,
    pageSize: 100,
    offset: 0,
    limit: 100,
  });
  assert.equal(getPagination({ page: '0x10', pageSize: '10' }).page, 1);
  assert.equal(getPagination({ page: '999999', pageSize: '100' }).offset, 999_900);
});

test('database scripts pin utf8mb4 collation for MySQL 8 seed comparisons', () => {
  const fromScratchSeed = readFileSync(
    resolve(__dirname, '../../db/scripts/01_from_scratch_superadmin_seed.sql'),
    'utf8',
  );

  assert.match(fromScratchSeed, /SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;/);
  assert.match(fromScratchSeed, /SET collation_connection = 'utf8mb4_unicode_ci';/);
  assert.match(
    fromScratchSeed,
    /WHERE email = CONVERT\(@esadar_super_admin_email USING utf8mb4\) COLLATE utf8mb4_unicode_ci/,
  );
});
