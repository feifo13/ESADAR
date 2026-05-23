-- ESADAR inventory split
-- Separates article publication/catalog data from inventory balances and movement ledger.

SET @OLD_FOREIGN_KEY_CHECKS := @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS article_inventory (
  article_id BIGINT UNSIGNED NOT NULL,
  quantity_total INT UNSIGNED NOT NULL DEFAULT 1,
  quantity_available INT UNSIGNED NOT NULL DEFAULT 1,
  quantity_reserved INT UNSIGNED NOT NULL DEFAULT 0,
  quantity_sold INT UNSIGNED NOT NULL DEFAULT 0,
  quantity_lost INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (article_id),
  KEY idx_article_inventory_updated_by (updated_by),
  CONSTRAINT fk_article_inventory_article FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_article_inventory_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_article_inventory_balance CHECK (quantity_total = quantity_available + quantity_reserved + quantity_sold + quantity_lost)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS article_inventory_movements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  article_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NULL,
  movement_type ENUM(
    'INITIAL_STOCK',
    'MANUAL_ADJUSTMENT',
    'RESERVE',
    'RELEASE_RESERVATION',
    'SALE',
    'LOSS',
    'RETURN'
  ) NOT NULL,
  available_delta INT NOT NULL DEFAULT 0,
  reserved_delta INT NOT NULL DEFAULT 0,
  sold_delta INT NOT NULL DEFAULT 0,
  lost_delta INT NOT NULL DEFAULT 0,
  quantity_available_after INT UNSIGNED NOT NULL,
  quantity_reserved_after INT UNSIGNED NOT NULL,
  quantity_sold_after INT UNSIGNED NOT NULL,
  quantity_lost_after INT UNSIGNED NOT NULL,
  reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY idx_article_inventory_movements_article_id (article_id),
  KEY idx_article_inventory_movements_order_id (order_id),
  KEY idx_article_inventory_movements_type (movement_type),
  KEY idx_article_inventory_movements_created_at (created_at),
  KEY idx_article_inventory_movements_created_by (created_by),
  CONSTRAINT fk_article_inventory_movements_article FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_article_inventory_movements_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_article_inventory_movements_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;

DELIMITER //
CREATE PROCEDURE esadar_inventory_split_guard()
BEGIN
  IF EXISTS (
    SELECT 1
    FROM articles
    WHERE COALESCE(quantity_total, 1) < COALESCE(quantity_available, 1) + COALESCE(quantity_reserved, 0) + COALESCE(quantity_sold, 0)
    LIMIT 1
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Inventory split aborted: articles contains inconsistent stock balances.';
  END IF;
END //
DELIMITER ;

CALL esadar_inventory_split_guard();
DROP PROCEDURE esadar_inventory_split_guard;

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
  id,
  COALESCE(quantity_total, 1),
  COALESCE(quantity_available, 1),
  COALESCE(quantity_reserved, 0),
  COALESCE(quantity_sold, 0),
  COALESCE(quantity_total, 1) - COALESCE(quantity_available, 1) - COALESCE(quantity_reserved, 0) - COALESCE(quantity_sold, 0),
  updated_by
FROM articles
ON DUPLICATE KEY UPDATE
  quantity_total = VALUES(quantity_total),
  quantity_available = VALUES(quantity_available),
  quantity_reserved = VALUES(quantity_reserved),
  quantity_sold = VALUES(quantity_sold),
  quantity_lost = VALUES(quantity_lost),
  updated_by = VALUES(updated_by);

INSERT INTO article_inventory_movements (
  article_id,
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
  'INITIAL_STOCK',
  ai.quantity_available,
  ai.quantity_reserved,
  ai.quantity_sold,
  ai.quantity_lost,
  ai.quantity_available,
  ai.quantity_reserved,
  ai.quantity_sold,
  ai.quantity_lost,
  'Inventario inicial migrado desde articles',
  ai.updated_by
FROM article_inventory ai
WHERE NOT EXISTS (
  SELECT 1
  FROM article_inventory_movements aim
  WHERE aim.article_id = ai.article_id
    AND aim.movement_type = 'INITIAL_STOCK'
);

ALTER TABLE orders
  ADD COLUMN tracking_code VARCHAR(120) NULL AFTER internal_notes;

ALTER TABLE order_status_history
  ADD COLUMN event_type ENUM('STATUS_CHANGE','TRACKING_UPDATED') NOT NULL DEFAULT 'STATUS_CHANGE' AFTER id,
  ADD COLUMN metadata_json JSON NULL AFTER reason;

ALTER TABLE order_status_history
  ADD KEY idx_order_status_history_event_type (event_type);

CREATE TABLE IF NOT EXISTS site_hero (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(180) NULL,
  subtitle VARCHAR(500) NULL,
  cta_label VARCHAR(120) NULL,
  cta_url VARCHAR(500) NULL,
  image_url VARCHAR(500) NULL,
  image_alt VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY idx_site_hero_active (is_active, updated_at),
  KEY idx_site_hero_updated_by (updated_by),
  CONSTRAINT fk_site_hero_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE articles
  DROP CHECK chk_articles_quantity_balance;

UPDATE articles
SET status = 'ACTIVE'
WHERE status IN ('RESERVED', 'SOLD_OUT');

ALTER TABLE articles
  MODIFY status ENUM('DRAFT','ACTIVE','INACTIVE','ARCHIVED') NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE articles
  DROP COLUMN quantity_total,
  DROP COLUMN quantity_available,
  DROP COLUMN quantity_reserved,
  DROP COLUMN quantity_sold;

-- article_stock_movements is intentionally left in place as a deprecated
-- legacy ledger for local dumps that already contain it. Runtime code writes
-- exclusively to article_inventory_movements after this migration.
