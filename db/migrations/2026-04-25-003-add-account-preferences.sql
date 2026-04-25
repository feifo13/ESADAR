USE secondhand_store_v1;

SET @has_customers_preferred_payment_method := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customers'
    AND COLUMN_NAME = 'preferred_payment_method'
);

SET @customers_preferred_payment_method_sql := IF(
  @has_customers_preferred_payment_method = 0,
  "ALTER TABLE customers ADD COLUMN preferred_payment_method VARCHAR(80) NULL AFTER instagram",
  'SELECT 1'
);

PREPARE stmt FROM @customers_preferred_payment_method_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_customers_preferred_shipping_method_id := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customers'
    AND COLUMN_NAME = 'preferred_shipping_method_id'
);

SET @customers_preferred_shipping_method_id_sql := IF(
  @has_customers_preferred_shipping_method_id = 0,
  "ALTER TABLE customers ADD COLUMN preferred_shipping_method_id BIGINT UNSIGNED NULL AFTER preferred_payment_method",
  'SELECT 1'
);

PREPARE stmt FROM @customers_preferred_shipping_method_id_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_customers_preferred_shipping_method_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customers'
    AND INDEX_NAME = 'idx_customers_preferred_shipping_method_id'
);

SET @customers_preferred_shipping_method_idx_sql := IF(
  @has_customers_preferred_shipping_method_idx = 0,
  'CREATE INDEX idx_customers_preferred_shipping_method_id ON customers (preferred_shipping_method_id)',
  'SELECT 1'
);

PREPARE stmt FROM @customers_preferred_shipping_method_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_customers_preferred_shipping_method_fk := (
  SELECT COUNT(*)
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customers'
    AND CONSTRAINT_NAME = 'fk_customers_preferred_shipping_method'
);

SET @customers_preferred_shipping_method_fk_sql := IF(
  @has_customers_preferred_shipping_method_fk = 0,
  'ALTER TABLE customers ADD CONSTRAINT fk_customers_preferred_shipping_method FOREIGN KEY (preferred_shipping_method_id) REFERENCES shipping_methods(id) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);

PREPARE stmt FROM @customers_preferred_shipping_method_fk_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_customer_addresses_delivery_notes := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_addresses'
    AND COLUMN_NAME = 'delivery_notes'
);

SET @customer_addresses_delivery_notes_sql := IF(
  @has_customer_addresses_delivery_notes = 0,
  "ALTER TABLE customer_addresses ADD COLUMN delivery_notes TEXT NULL AFTER postal_code",
  'SELECT 1'
);

PREPARE stmt FROM @customer_addresses_delivery_notes_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
