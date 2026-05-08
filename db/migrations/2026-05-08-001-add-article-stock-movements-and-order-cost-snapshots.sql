-- Professional inventory ledger and historical cost snapshots.

CREATE TABLE IF NOT EXISTS article_stock_movements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  article_id BIGINT UNSIGNED NOT NULL,
  movement_type ENUM(
    'INITIAL',
    'MANUAL_ADJUSTMENT',
    'RESERVE',
    'RELEASE_RESERVATION',
    'SALE',
    'CANCEL_ORDER',
    'RETURN',
    'LOSS'
  ) NOT NULL,
  quantity_delta INT NOT NULL,
  from_available INT UNSIGNED NULL,
  to_available INT UNSIGNED NULL,
  from_reserved INT UNSIGNED NULL,
  to_reserved INT UNSIGNED NULL,
  from_sold INT UNSIGNED NULL,
  to_sold INT UNSIGNED NULL,
  reason VARCHAR(255) NULL,
  order_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  INDEX idx_article_stock_movements_article_id (article_id),
  INDEX idx_article_stock_movements_order_id (order_id),
  INDEX idx_article_stock_movements_type (movement_type),
  INDEX idx_article_stock_movements_created_at (created_at)
) ENGINE=InnoDB;

SET @has_order_items_purchase_item_snapshot := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'order_items'
    AND COLUMN_NAME = 'purchase_price_item_snapshot'
);

SET @order_items_purchase_item_snapshot_sql := IF(
  @has_order_items_purchase_item_snapshot = 0,
  'ALTER TABLE order_items ADD COLUMN purchase_price_item_snapshot DECIMAL(12,2) NULL AFTER line_total_snapshot',
  'SELECT 1'
);

PREPARE stmt FROM @order_items_purchase_item_snapshot_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_order_items_purchase_shipping_snapshot := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'order_items'
    AND COLUMN_NAME = 'purchase_price_shipping_snapshot'
);

SET @order_items_purchase_shipping_snapshot_sql := IF(
  @has_order_items_purchase_shipping_snapshot = 0,
  'ALTER TABLE order_items ADD COLUMN purchase_price_shipping_snapshot DECIMAL(12,2) NULL AFTER purchase_price_item_snapshot',
  'SELECT 1'
);

PREPARE stmt FROM @order_items_purchase_shipping_snapshot_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_order_items_purchase_courier_snapshot := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'order_items'
    AND COLUMN_NAME = 'purchase_price_courier_snapshot'
);

SET @order_items_purchase_courier_snapshot_sql := IF(
  @has_order_items_purchase_courier_snapshot = 0,
  'ALTER TABLE order_items ADD COLUMN purchase_price_courier_snapshot DECIMAL(12,2) NULL AFTER purchase_price_shipping_snapshot',
  'SELECT 1'
);

PREPARE stmt FROM @order_items_purchase_courier_snapshot_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_order_items_purchase_total_snapshot := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'order_items'
    AND COLUMN_NAME = 'purchase_price_total_snapshot'
);

SET @order_items_purchase_total_snapshot_sql := IF(
  @has_order_items_purchase_total_snapshot = 0,
  'ALTER TABLE order_items ADD COLUMN purchase_price_total_snapshot DECIMAL(12,2) NULL AFTER purchase_price_courier_snapshot',
  'SELECT 1'
);

PREPARE stmt FROM @order_items_purchase_total_snapshot_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_order_items_profit_snapshot := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'order_items'
    AND COLUMN_NAME = 'profit_snapshot'
);

SET @order_items_profit_snapshot_sql := IF(
  @has_order_items_profit_snapshot = 0,
  'ALTER TABLE order_items ADD COLUMN profit_snapshot DECIMAL(12,2) NULL AFTER purchase_price_total_snapshot',
  'SELECT 1'
);

PREPARE stmt FROM @order_items_profit_snapshot_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
