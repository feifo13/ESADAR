-- =========================================================
-- ESADAR - Limpieza de rangos default solapados
-- Fecha: 2026-05-19
-- Objetivo:
--   - Eliminar rangos oficiales por defecto solo cuando se solapan
--     con rangos personalizados del mismo método.
--   - Evitar solapamientos creados por migraciones idempotentes previas.
-- =========================================================

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET collation_connection = 'utf8mb4_unicode_ci';
SET time_zone = '+00:00';

CREATE TEMPORARY TABLE tmp_esadar_default_shipping_rates (
  min_weight_kg DECIMAL(8,3) NOT NULL,
  max_weight_kg DECIMAL(8,3) NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  label VARCHAR(120) NOT NULL,
  PRIMARY KEY (min_weight_kg, max_weight_kg, price, label)
) ENGINE=Memory;

CREATE TEMPORARY TABLE tmp_esadar_default_shipping_rates_probe (
  min_weight_kg DECIMAL(8,3) NOT NULL,
  max_weight_kg DECIMAL(8,3) NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  label VARCHAR(120) NOT NULL,
  PRIMARY KEY (min_weight_kg, max_weight_kg, price, label)
) ENGINE=Memory;

CREATE TEMPORARY TABLE tmp_esadar_default_rate_delete_ids (
  id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id)
) ENGINE=Memory;

INSERT INTO tmp_esadar_default_shipping_rates (
  min_weight_kg,
  max_weight_kg,
  price,
  label
)
VALUES
  (0.000, 2.000, 195.00, 'Hasta 2 kg'),
  (2.000, 5.000, 220.00, 'De 2 a 5 kg'),
  (5.000, 10.000, 275.00, 'De 5 a 10 kg'),
  (10.000, 15.000, 325.00, 'De 10 a 15 kg'),
  (15.000, 20.000, 405.00, 'De 15 a 20 kg'),
  (20.000, 25.000, 465.00, 'De 20 a 25 kg'),
  (25.000, 30.000, 550.00, 'De 25 a 30 kg');

INSERT INTO tmp_esadar_default_shipping_rates_probe (
  min_weight_kg,
  max_weight_kg,
  price,
  label
)
SELECT
  min_weight_kg,
  max_weight_kg,
  price,
  label
FROM tmp_esadar_default_shipping_rates;

INSERT IGNORE INTO tmp_esadar_default_rate_delete_ids (id)
SELECT DISTINCT swr.id
FROM shipping_method_weight_rates swr
INNER JOIN shipping_methods sm ON sm.id = swr.shipping_method_id
INNER JOIN tmp_esadar_default_shipping_rates defaults
  ON defaults.min_weight_kg = swr.min_weight_kg
  AND defaults.max_weight_kg = swr.max_weight_kg
  AND defaults.price = swr.price
  AND defaults.label = COALESCE(swr.label, '')
INNER JOIN shipping_method_weight_rates custom_rate
  ON custom_rate.shipping_method_id = swr.shipping_method_id
  AND custom_rate.id <> swr.id
  AND custom_rate.is_active = 1
  AND swr.is_active = 1
  AND custom_rate.min_weight_kg < swr.max_weight_kg
  AND swr.min_weight_kg < custom_rate.max_weight_kg
LEFT JOIN tmp_esadar_default_shipping_rates_probe custom_default
  ON custom_default.min_weight_kg = custom_rate.min_weight_kg
  AND custom_default.max_weight_kg = custom_rate.max_weight_kg
  AND custom_default.price = custom_rate.price
  AND custom_default.label = COALESCE(custom_rate.label, '')
WHERE (LOWER(sm.description) LIKE '%ahiva%' OR LOWER(sm.description) LIKE '%correo%')
  AND custom_default.min_weight_kg IS NULL;

DELETE swr
FROM shipping_method_weight_rates swr
INNER JOIN tmp_esadar_default_rate_delete_ids delete_ids ON delete_ids.id = swr.id;

DROP TEMPORARY TABLE IF EXISTS tmp_esadar_default_shipping_rates;
DROP TEMPORARY TABLE IF EXISTS tmp_esadar_default_shipping_rates_probe;
DROP TEMPORARY TABLE IF EXISTS tmp_esadar_default_rate_delete_ids;
