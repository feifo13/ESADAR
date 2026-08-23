-- =========================================================
-- ESADAR SANDBOX - VACIADO OPERATIVO CANONICO
-- =========================================================
-- Uso exclusivo: sandbox/E2E. El target explicito impide usar este
-- script sobre otra base aun cuando se invoque el cliente directamente.
--
-- Preserva sin reseed ni mutaciones:
--   - users, roles, user_roles y user_auth_identities;
--   - customers y customer_addresses;
--   - articles, article_images, article_lots y catalogos maestros;
--   - company_collecting_settings, Mercado Pago, cobros y shipping;
--   - configuracion SEO, hero, ticker y demas configuracion funcional.
--
-- Limpia datos transaccionales, temporales y derivados. Normaliza cada
-- article_inventory a 100 disponible y crea exactamente un movimiento
-- INITIAL_STOCK coherente por articulo.
--
-- No ejecutar en produccion. Usar backend/scripts/run-db-script.mjs con
-- --execute, --confirm-db esadar_sandbox y --allow-destructive.
-- =========================================================

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET collation_connection = 'utf8mb4_unicode_ci';
SET time_zone = '+00:00';

USE esadar_sandbox;

START TRANSACTION;

-- Logs y datos derivados sin dependencias operativas descendentes.
DELETE FROM audit_log;
DELETE FROM client_error_logs;

-- Hijos de orden/oferta/carrito, incluidas todas las evidencias MP.
DELETE FROM order_payment_retry_capabilities;
DELETE FROM mercado_pago_checkout_preferences;
DELETE FROM mercado_pago_preference_events;
DELETE FROM mercado_pago_webhook_events;
DELETE FROM payments;
DELETE FROM offer_status_history;
DELETE FROM order_status_history;
DELETE FROM cart_items;
DELETE FROM order_items;
DELETE FROM article_inventory_movements;

-- Ledger pre-split opcional: solo puede existir en bases actualizadas
-- desde esquemas historicos. No forma parte del esquema consolidado nuevo.
SET @esadar_has_legacy_stock_movements := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'article_stock_movements'
);
SET @esadar_clear_legacy_stock_movements_sql := IF(
  @esadar_has_legacy_stock_movements > 0,
  'DELETE FROM article_stock_movements',
  'SELECT 1'
);
PREPARE esadar_clear_legacy_stock_movements_stmt
  FROM @esadar_clear_legacy_stock_movements_sql;
EXECUTE esadar_clear_legacy_stock_movements_stmt;
DEALLOCATE PREPARE esadar_clear_legacy_stock_movements_stmt;

-- Entidades operativas principales, ya sin filas hijas restrictivas.
DELETE FROM offers;
DELETE FROM orders;
DELETE FROM carts;

-- Interaccion, leads, temporales e importaciones de prueba.
DELETE FROM wishlist_items;
DELETE FROM wishlists;
DELETE FROM article_events;
DELETE FROM public_page_visits;
DELETE FROM article_interest_alerts;
DELETE FROM lead_preferences;
DELETE FROM contact_messages;
DELETE FROM password_reset_tokens;
DELETE FROM article_import_batch_items;
DELETE FROM article_import_batches;

-- potential_customers representa prospectos/guest transitorios. Los
-- customers persistentes (incluidos los vinculados a users) se preservan.
DELETE FROM potential_customers;

-- Completa inventarios faltantes sin tocar ninguna columna de articles.
INSERT INTO article_inventory (
  article_id,
  quantity_total,
  quantity_available,
  quantity_reserved,
  quantity_sold,
  quantity_lost,
  updated_by
)
SELECT
  a.id,
  100,
  100,
  0,
  0,
  0,
  a.updated_by
FROM articles a
LEFT JOIN article_inventory ai ON ai.article_id = a.id
WHERE ai.article_id IS NULL;

-- Baseline idempotente: nunca suma sobre el stock anterior.
UPDATE article_inventory
SET quantity_total = 100,
    quantity_available = 100,
    quantity_reserved = 0,
    quantity_sold = 0,
    quantity_lost = 0;

-- Tras borrar el historial, INITIAL_STOCK representa todo el ledger limpio.
INSERT INTO article_inventory_movements (
  article_id,
  order_id,
  movement_type,
  available_delta,
  reserved_delta,
  sold_delta,
  lost_delta,
  quantity_available_after,
  quantity_reserved_after,
  quantity_sold_after,
  quantity_lost_after,
  reason,
  created_by
)
SELECT
  ai.article_id,
  NULL,
  'INITIAL_STOCK',
  100,
  0,
  0,
  0,
  100,
  0,
  0,
  0,
  'Baseline del vaciado operativo sandbox',
  NULL
FROM article_inventory ai;

COMMIT;

-- Verificacion no sensible para la salida del runner.
SELECT
  (SELECT COUNT(*) FROM orders) = 0
      AS orders_empty,
  (SELECT COUNT(*) FROM order_items) = 0
      AS order_items_empty,
  (SELECT COUNT(*) FROM order_status_history) = 0
      AS order_status_history_empty,
  (SELECT COUNT(*) FROM payments) = 0
      AS payments_empty,
  (SELECT COUNT(*) FROM mercado_pago_checkout_preferences) = 0
      AS mercado_pago_checkout_preferences_empty,
  (SELECT COUNT(*) FROM mercado_pago_preference_events) = 0
      AS mercado_pago_preference_events_empty,
  (SELECT COUNT(*) FROM mercado_pago_webhook_events) = 0
      AS mercado_pago_webhook_events_empty,
  (SELECT COUNT(*) FROM carts) = 0
      AS carts_empty,
  (SELECT COUNT(*) FROM cart_items) = 0
      AS cart_items_empty,
  (SELECT COUNT(*) FROM articles)
    = (SELECT COUNT(*) FROM article_inventory)
      AS article_inventory_rows_match,
  (SELECT COUNT(*) FROM article_inventory
    WHERE quantity_total <> 100
       OR quantity_available <> 100
       OR quantity_reserved <> 0
       OR quantity_sold <> 0
       OR quantity_lost <> 0) = 0
      AS article_inventory_baseline_matches,
  (SELECT COUNT(*) FROM article_inventory_movements)
    = (SELECT COUNT(*) FROM articles)
      AS article_inventory_ledger_rows_match;
