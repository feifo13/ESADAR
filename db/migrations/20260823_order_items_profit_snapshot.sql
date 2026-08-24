-- =========================================================
-- ESADAR - Contrato de snapshot de ganancia en order_items
-- Fecha: 2026-08-23
-- Objetivo:
--   - Garantizar profit_snapshot en la cadena incremental de migraciones.
--   - Mantener históricos desconocidos como NULL, sin reconstrucción.
-- =========================================================

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET collation_connection = 'utf8mb4_unicode_ci';
SET time_zone = '+00:00';

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'order_items'
    AND COLUMN_NAME = 'profit_snapshot'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE order_items ADD COLUMN profit_snapshot DECIMAL(12,2) NULL AFTER total_cost_snapshot',
  'SELECT "order_items.profit_snapshot already exists" AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
