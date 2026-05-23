-- =========================================================
-- ESADAR - Shipping configurable por peso
-- Fecha: 2026-05-19
-- Objetivo:
--   - Agregar peso por artículo.
--   - Congelar peso usado en orden e ítems.
--   - Permitir métodos de envío con rangos de precio por peso.
--   - Mantener compatibilidad con métodos de costo fijo existentes.
-- =========================================================

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET collation_connection = 'utf8mb4_unicode_ci';
SET time_zone = '+00:00';

-- ---------------------------------------------------------
-- Columns idempotentes
-- ---------------------------------------------------------

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'articles'
    AND COLUMN_NAME = 'weight_kg'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE articles ADD COLUMN weight_kg DECIMAL(8,3) NOT NULL DEFAULT 0.000 AFTER description',
  'SELECT "articles.weight_kg already exists" AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'shipping_methods'
    AND COLUMN_NAME = 'pricing_type'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE shipping_methods ADD COLUMN pricing_type ENUM(''FIXED'',''AHIVA_CORREO_NACIONAL'',''WEIGHT_RANGES'') NOT NULL DEFAULT ''FIXED'' AFTER base_cost',
  'ALTER TABLE shipping_methods MODIFY COLUMN pricing_type ENUM(''FIXED'',''AHIVA_CORREO_NACIONAL'',''WEIGHT_RANGES'') NOT NULL DEFAULT ''FIXED'''
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'package_weight_kg_snapshot'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE orders ADD COLUMN package_weight_kg_snapshot DECIMAL(8,3) NOT NULL DEFAULT 0.000 AFTER shipping_cost_snapshot',
  'SELECT "orders.package_weight_kg_snapshot already exists" AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'order_items'
    AND COLUMN_NAME = 'weight_kg_snapshot'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE order_items ADD COLUMN weight_kg_snapshot DECIMAL(8,3) NOT NULL DEFAULT 0.000 AFTER line_total_snapshot',
  'SELECT "order_items.weight_kg_snapshot already exists" AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'order_items'
    AND COLUMN_NAME = 'line_weight_kg_snapshot'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE order_items ADD COLUMN line_weight_kg_snapshot DECIMAL(8,3) NOT NULL DEFAULT 0.000 AFTER weight_kg_snapshot',
  'SELECT "order_items.line_weight_kg_snapshot already exists" AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------
-- Tabla de rangos por peso
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS shipping_method_weight_rates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  shipping_method_id BIGINT UNSIGNED NOT NULL,
  min_weight_kg DECIMAL(8,3) NOT NULL DEFAULT 0.000,
  max_weight_kg DECIMAL(8,3) NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  label VARCHAR(120) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY idx_shipping_weight_rates_method (shipping_method_id, is_active, sort_order),
  KEY idx_shipping_weight_rates_range (shipping_method_id, min_weight_kg, max_weight_kg),
  KEY idx_shipping_weight_rates_created_by (created_by),
  KEY idx_shipping_weight_rates_updated_by (updated_by),
  CONSTRAINT chk_shipping_weight_rates_weight CHECK (min_weight_kg >= 0 AND max_weight_kg > min_weight_kg),
  CONSTRAINT chk_shipping_weight_rates_price CHECK (price >= 0),
  CONSTRAINT fk_shipping_weight_rates_method FOREIGN KEY (shipping_method_id) REFERENCES shipping_methods(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_shipping_weight_rates_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_shipping_weight_rates_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- Seeds Ahiva / Correo Uruguayo
-- ---------------------------------------------------------

INSERT INTO shipping_methods (
  description,
  base_cost,
  pricing_type,
  instructions,
  is_active
)
SELECT
  'Ahiva / Correo Uruguayo',
  195.00,
  'WEIGHT_RANGES',
  'Tarifa nacional calculada por peso aproximado del paquete según tabla Ahiva / Correo Uruguayo.',
  1
WHERE NOT EXISTS (
  SELECT 1
  FROM shipping_methods
  WHERE LOWER(description) LIKE '%ahiva%'
     OR LOWER(description) LIKE '%correo%'
);

UPDATE shipping_methods
SET pricing_type = 'WEIGHT_RANGES'
WHERE LOWER(description) LIKE '%ahiva%'
   OR LOWER(description) LIKE '%correo%';

INSERT INTO shipping_method_weight_rates (
  shipping_method_id,
  min_weight_kg,
  max_weight_kg,
  price,
  label,
  sort_order,
  is_active
)
SELECT sm.id, rates.min_weight_kg, rates.max_weight_kg, rates.price, rates.label, rates.sort_order, 1
FROM shipping_methods sm
JOIN (
  SELECT 0.000 AS min_weight_kg, 2.000 AS max_weight_kg, 195.00 AS price, 'Hasta 2 kg' AS label, 1 AS sort_order
  UNION ALL SELECT 2.000, 5.000, 220.00, 'De 2 a 5 kg', 2
  UNION ALL SELECT 5.000, 10.000, 275.00, 'De 5 a 10 kg', 3
  UNION ALL SELECT 10.000, 15.000, 325.00, 'De 10 a 15 kg', 4
  UNION ALL SELECT 15.000, 20.000, 405.00, 'De 15 a 20 kg', 5
  UNION ALL SELECT 20.000, 25.000, 465.00, 'De 20 a 25 kg', 6
  UNION ALL SELECT 25.000, 30.000, 550.00, 'De 25 a 30 kg', 7
) rates
WHERE (LOWER(sm.description) LIKE '%ahiva%' OR LOWER(sm.description) LIKE '%correo%')
  AND NOT EXISTS (
    SELECT 1
    FROM shipping_method_weight_rates existing
    WHERE existing.shipping_method_id = sm.id
  );
