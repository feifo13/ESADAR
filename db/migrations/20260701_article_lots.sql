-- =========================================================
-- ESADAR - Lotes comerciales de articulos
-- Fecha: 2026-07-01
-- Objetivo:
--   - Crear article_lots como entidad de negocio.
--   - Crear y aplicar LOTE-0001 a articulos existentes.
--   - Congelar snapshot de lote en order_items existentes y futuros.
--   - Mantener migracion idempotente.
-- =========================================================

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET collation_connection = 'utf8mb4_unicode_ci';
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS article_lots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(160) NOT NULL,
  description TEXT NULL,
  source_label VARCHAR(120) NULL,
  acquisition_date DATE NULL,
  arrival_date DATE NULL,
  status ENUM('OPEN','CLOSED','ARCHIVED') NOT NULL DEFAULT 'OPEN',
  notes TEXT NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_article_lots_code (code),
  KEY idx_article_lots_status (status),
  KEY idx_article_lots_acquisition_date (acquisition_date),
  KEY idx_article_lots_arrival_date (arrival_date),
  KEY idx_article_lots_created_by (created_by),
  KEY idx_article_lots_updated_by (updated_by),
  CONSTRAINT fk_article_lots_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_article_lots_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

INSERT INTO article_lots (
  code,
  name,
  description,
  status
) VALUES (
  'LOTE-0001',
  'Lote inicial ESADAR',
  'Articulos iniciales cargados antes de la gestion formal de lotes.',
  'OPEN'
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  status = IF(status = 'ARCHIVED', status, VALUES(status));

SET @initial_lot_id := (
  SELECT id
  FROM article_lots
  WHERE code = 'LOTE-0001'
  LIMIT 1
);

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'articles'
    AND COLUMN_NAME = 'lot_id'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE articles ADD COLUMN lot_id BIGINT UNSIGNED NULL AFTER id',
  'SELECT "articles.lot_id already exists" AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE articles
SET lot_id = @initial_lot_id
WHERE lot_id IS NULL;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'articles'
    AND INDEX_NAME = 'idx_articles_lot_id'
);
SET @sql := IF(@idx_exists = 0,
  'ALTER TABLE articles ADD KEY idx_articles_lot_id (lot_id)',
  'SELECT "idx_articles_lot_id already exists" AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'articles'
    AND CONSTRAINT_NAME = 'fk_articles_lot'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE articles ADD CONSTRAINT fk_articles_lot FOREIGN KEY (lot_id) REFERENCES article_lots(id) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT "fk_articles_lot already exists" AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'order_items'
    AND COLUMN_NAME = 'lot_id_snapshot'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE order_items ADD COLUMN lot_id_snapshot BIGINT UNSIGNED NULL AFTER image_snapshot',
  'SELECT "order_items.lot_id_snapshot already exists" AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'order_items'
    AND COLUMN_NAME = 'lot_code_snapshot'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE order_items ADD COLUMN lot_code_snapshot VARCHAR(80) NULL AFTER lot_id_snapshot',
  'SELECT "order_items.lot_code_snapshot already exists" AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'order_items'
    AND COLUMN_NAME = 'lot_name_snapshot'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE order_items ADD COLUMN lot_name_snapshot VARCHAR(160) NULL AFTER lot_code_snapshot',
  'SELECT "order_items.lot_name_snapshot already exists" AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE order_items
SET
  lot_id_snapshot = COALESCE(lot_id_snapshot, @initial_lot_id),
  lot_code_snapshot = COALESCE(NULLIF(lot_code_snapshot, ''), 'LOTE-0001'),
  lot_name_snapshot = COALESCE(NULLIF(lot_name_snapshot, ''), 'Lote inicial ESADAR')
WHERE lot_id_snapshot IS NULL
  OR lot_code_snapshot IS NULL
  OR lot_code_snapshot = ''
  OR lot_name_snapshot IS NULL
  OR lot_name_snapshot = '';

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'order_items'
    AND INDEX_NAME = 'idx_order_items_lot_id_snapshot'
);
SET @sql := IF(@idx_exists = 0,
  'ALTER TABLE order_items ADD KEY idx_order_items_lot_id_snapshot (lot_id_snapshot)',
  'SELECT "idx_order_items_lot_id_snapshot already exists" AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'order_items'
    AND CONSTRAINT_NAME = 'fk_order_items_lot_snapshot'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql := IF(@fk_exists = 0,
  'ALTER TABLE order_items ADD CONSTRAINT fk_order_items_lot_snapshot FOREIGN KEY (lot_id_snapshot) REFERENCES article_lots(id) ON DELETE RESTRICT ON UPDATE CASCADE',
  'SELECT "fk_order_items_lot_snapshot already exists" AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
