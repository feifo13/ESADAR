-- =========================================================
-- ESADAR - Documentos oficiales y consolidacion envio por peso
-- Fecha: 2026-05-19
-- Objetivo:
--   - Agregar link/path oficial configurable por metodo de envio.
--   - Confirmar soporte para metodos con rangos por peso.
--   - Completar tarifas Ahiva / Correo cuando no haya rangos cargados.
-- =========================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ---------------------------------------------------------
-- shipping_methods: campos de documento oficial
-- ---------------------------------------------------------

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'shipping_methods'
    AND COLUMN_NAME = 'official_rates_label'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE shipping_methods ADD COLUMN official_rates_label VARCHAR(120) NULL AFTER instructions',
  'SELECT "shipping_methods.official_rates_label already exists" AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'shipping_methods'
    AND COLUMN_NAME = 'official_rates_url'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE shipping_methods ADD COLUMN official_rates_url VARCHAR(500) NULL AFTER official_rates_label',
  'SELECT "shipping_methods.official_rates_url already exists" AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'shipping_methods'
    AND COLUMN_NAME = 'official_rates_file_path'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE shipping_methods ADD COLUMN official_rates_file_path VARCHAR(500) NULL AFTER official_rates_url',
  'SELECT "shipping_methods.official_rates_file_path already exists" AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------
-- pricing_type: mantener compatibilidad y habilitar WEIGHT_RANGES
-- ---------------------------------------------------------

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

-- ---------------------------------------------------------
-- Tabla de rangos por peso si todavia no existe
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
-- Ahiva / Correo: costo por rangos y PDF oficial por defecto
-- ---------------------------------------------------------

UPDATE shipping_methods
SET
  pricing_type = 'WEIGHT_RANGES',
  official_rates_label = COALESCE(NULLIF(TRIM(official_rates_label), ''), 'Ver tarifas oficiales'),
  official_rates_file_path = COALESCE(NULLIF(TRIM(official_rates_file_path), ''), '/docs/tarifas-ahiva-correo.pdf')
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
