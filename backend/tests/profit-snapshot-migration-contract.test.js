import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('incremental migration chain guarantees nullable profit_snapshot without backfill', () => {
  const migration = readFileSync(
    resolve(__dirname, '../../db/migrations/20260823_order_items_profit_snapshot.sql'),
    'utf8',
  );

  assert.match(migration, /information_schema\.COLUMNS/i);
  assert.match(migration, /TABLE_NAME\s*=\s*'order_items'/i);
  assert.match(migration, /COLUMN_NAME\s*=\s*'profit_snapshot'/i);
  assert.match(migration, /ADD COLUMN profit_snapshot DECIMAL\(12,2\) NULL AFTER total_cost_snapshot/i);
  assert.doesNotMatch(migration, /UPDATE\s+order_items/i);
  assert.doesNotMatch(migration, /COALESCE\s*\(/i);
});
