import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLikeValue,
  resolveSortClause,
} from '../src/utils/listing.js';
import {
  buildSqlLimitClause,
  buildSqlLimitOffsetClause,
  normalizeSqlLimit,
  normalizeSqlOffset,
  resolveAllowedSqlIdentifier,
} from '../src/utils/sql-safety.js';

test('buildLikeValue keeps search as a prepared-statement value', () => {
  assert.equal(buildLikeValue('  nike  '), '%nike%');
  assert.equal(buildLikeValue("' OR '1'='1"), "%' OR '1'='1%");
});

test('SQL LIMIT/OFFSET helpers only emit sane integer literals', () => {
  assert.equal(normalizeSqlLimit('12', 25, 100), 12);
  assert.equal(normalizeSqlLimit('999', 25, 100), 100);
  assert.equal(normalizeSqlLimit('12; DROP TABLE users;', 25, 100), 25);
  assert.equal(normalizeSqlOffset('40'), 40);
  assert.equal(normalizeSqlOffset('-1'), 0);
  assert.equal(normalizeSqlOffset('0 OR 1=1'), 0);
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
