-- =========================================================
-- ESADAR - Tasa configurable de impuestos bancarios y snapshots
-- Fecha: 2026-07-01
-- Objetivo:
--   - Configurar la tasa de impuestos bancarios desde backoffice.
--   - Congelar base, tasa, impuesto, costo total y ganancia neta en order_items.
--   - Mantener purchase_price_total_snapshot como costo compra.
-- =========================================================

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET collation_connection = 'utf8mb4_unicode_ci';
SET time_zone = '+00:00';

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'company_collecting_settings'
    AND COLUMN_NAME = 'bank_tax_rate'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE company_collecting_settings ADD COLUMN bank_tax_rate DECIMAL(8,6) NOT NULL DEFAULT 0.025000 AFTER id',
  'SELECT "company_collecting_settings.bank_tax_rate already exists" AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE company_collecting_settings
SET bank_tax_rate = 0.025000
WHERE bank_tax_rate IS NULL;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'order_items'
    AND COLUMN_NAME = 'bank_tax_rate_snapshot'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE order_items ADD COLUMN bank_tax_rate_snapshot DECIMAL(8,6) NULL AFTER purchase_price_total_snapshot',
  'SELECT "order_items.bank_tax_rate_snapshot already exists" AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'order_items'
    AND COLUMN_NAME = 'bank_tax_base_snapshot'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE order_items ADD COLUMN bank_tax_base_snapshot DECIMAL(12,2) NULL AFTER bank_tax_rate_snapshot',
  'SELECT "order_items.bank_tax_base_snapshot already exists" AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'order_items'
    AND COLUMN_NAME = 'bank_tax_snapshot'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE order_items ADD COLUMN bank_tax_snapshot DECIMAL(12,2) NULL AFTER bank_tax_base_snapshot',
  'SELECT "order_items.bank_tax_snapshot already exists" AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'order_items'
    AND COLUMN_NAME = 'total_cost_snapshot'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE order_items ADD COLUMN total_cost_snapshot DECIMAL(12,2) NULL AFTER bank_tax_snapshot',
  'SELECT "order_items.total_cost_snapshot already exists" AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
