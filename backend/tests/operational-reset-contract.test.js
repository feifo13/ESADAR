import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  requiresBootstrapAdminCredentials,
  stripSqlComments,
} from '../scripts/lib/mysql-script-runner.mjs';

const scriptsDir = fileURLToPath(
  new URL('../../db/scripts/', import.meta.url),
);
const canonicalPath = fileURLToPath(
  new URL(
    '../../db/scripts/02_vaciado_operativo_sandbox.sql',
    import.meta.url,
  ),
);
const canonicalSql = await readFile(canonicalPath, 'utf8');
const executableSql = stripSqlComments(canonicalSql);

function expectDelete(table) {
  assert.match(
    executableSql,
    new RegExp(`\\bDELETE\\s+FROM\\s+${table}\\b`, 'i'),
    `Expected ${table} to be cleaned`,
  );
}

function expectNoMutation(table) {
  const mutations = [
    `\\bDELETE(?:\\s+[a-z][a-z0-9_]*)?\\s+FROM\\s+${table}\\b`,
    `\\bTRUNCATE(?:\\s+TABLE)?\\s+${table}\\b`,
    `\\bINSERT\\s+INTO\\s+${table}\\b`,
    `\\bUPDATE\\s+${table}\\b`,
  ];

  for (const mutation of mutations) {
    assert.doesNotMatch(
      executableSql,
      new RegExp(mutation, 'i'),
      `Unexpected mutation of preserved table ${table}`,
    );
  }
}

test('there is exactly one operational reset SQL script', async () => {
  const resetScripts = (await readdir(scriptsDir))
    .filter((name) => /vaciado_operativo/i.test(name));

  assert.deepEqual(
    resetScripts,
    ['02_vaciado_operativo_sandbox.sql'],
  );
});

test('canonical reset has no bootstrap or identity mutation contract', () => {
  assert.equal(
    requiresBootstrapAdminCredentials(canonicalSql),
    false,
  );
  assert.doesNotMatch(
    canonicalSql,
    /ESADAR_BOOTSTRAP_ADMIN_(?:EMAIL|PASSWORD)/,
  );
  assert.doesNotMatch(executableSql, /\\bpassword_hash\\b/i);

  for (const table of [
    'users',
    'roles',
    'user_roles',
    'user_auth_identities',
    'customers',
    'customer_addresses',
  ]) {
    expectNoMutation(table);
  }
});

test('canonical reset preserves catalog and all functional configuration', () => {
  for (const table of [
    'articles',
    'article_images',
    'article_lots',
    'categories',
    'brands',
    'sizes',
    'shipping_methods',
    'shipping_method_weight_rates',
    'company_collecting_settings',
    'site_pages_seo',
    'site_hero',
    'site_hero_images',
    'site_ticker_settings',
  ]) {
    expectNoMutation(table);
  }

  assert.doesNotMatch(
    executableSql,
    /mercado_pago_(?:access_token|webhook_secret|notification_url|public_key)/i,
  );
});

test('canonical reset cleans all current operational state', () => {
  for (const table of [
    'audit_log',
    'client_error_logs',
    'order_payment_retry_capabilities',
    'mercado_pago_checkout_preferences',
    'mercado_pago_preference_events',
    'mercado_pago_webhook_events',
    'payments',
    'offer_status_history',
    'offers',
    'order_status_history',
    'order_items',
    'orders',
    'cart_items',
    'carts',
    'wishlist_items',
    'wishlists',
    'article_events',
    'public_page_visits',
    'article_interest_alerts',
    'lead_preferences',
    'contact_messages',
    'potential_customers',
    'password_reset_tokens',
    'article_import_batch_items',
    'article_import_batches',
    'article_inventory_movements',
  ]) {
    expectDelete(table);
  }
});

test('canonical reset creates an idempotent stock-100 inventory baseline', () => {
  assert.match(
    executableSql,
    /INSERT\s+INTO\s+article_inventory\s*\([\s\S]*?FROM\s+articles\s+a[\s\S]*?WHERE\s+ai\.article_id\s+IS\s+NULL\s*;/i,
  );
  assert.match(
    executableSql,
    /UPDATE\s+article_inventory\s+SET\s+quantity_total\s*=\s*100\s*,\s*quantity_available\s*=\s*100\s*,\s*quantity_reserved\s*=\s*0\s*,\s*quantity_sold\s*=\s*0\s*,\s*quantity_lost\s*=\s*0\s*;/i,
  );
  assert.match(
    executableSql,
    /INSERT\s+INTO\s+article_inventory_movements[\s\S]*?'INITIAL_STOCK'[\s\S]*?FROM\s+article_inventory\s+ai\s*;/i,
  );
  assert.doesNotMatch(executableSql, /FOREIGN_KEY_CHECKS/i);
  assert.match(executableSql, /START\s+TRANSACTION/i);
  assert.match(executableSql, /COMMIT\s*;/i);
});
