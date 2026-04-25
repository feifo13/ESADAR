USE secondhand_store_v1;

SET @potential_customer_source_type := (
  SELECT COLUMN_TYPE
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'potential_customers'
    AND COLUMN_NAME = 'source'
);

SET @potential_customer_source_sql := IF(
  @potential_customer_source_type LIKE '%''CHECKOUT''%'
    AND @potential_customer_source_type LIKE '%''CONTACT_FORM''%'
    AND @potential_customer_source_type LIKE '%''MANUAL''%'
    AND @potential_customer_source_type LIKE '%''OFFER''%'
    AND @potential_customer_source_type LIKE '%''NEWSLETTER''%'
    AND @potential_customer_source_type LIKE '%''STOCK_ALERT''%'
    AND @potential_customer_source_type LIKE '%''WISHLIST''%'
    AND @potential_customer_source_type LIKE '%''ABANDONED_CART''%'
    AND @potential_customer_source_type LIKE '%''PRODUCT_INTEREST''%',
  'SELECT 1',
  "ALTER TABLE potential_customers MODIFY COLUMN source ENUM('CHECKOUT','CONTACT_FORM','MANUAL','OFFER','NEWSLETTER','STOCK_ALERT','WISHLIST','ABANDONED_CART','PRODUCT_INTEREST') NOT NULL DEFAULT 'CHECKOUT'"
);

PREPARE stmt FROM @potential_customer_source_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_potential_customers_phone_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'potential_customers'
    AND INDEX_NAME = 'idx_potential_customers_phone'
);

SET @potential_customers_phone_idx_sql := IF(
  @has_potential_customers_phone_idx = 0,
  'CREATE INDEX idx_potential_customers_phone ON potential_customers (phone)',
  'SELECT 1'
);

PREPARE stmt FROM @potential_customers_phone_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_potential_customers_instagram_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'potential_customers'
    AND INDEX_NAME = 'idx_potential_customers_instagram'
);

SET @potential_customers_instagram_idx_sql := IF(
  @has_potential_customers_instagram_idx = 0,
  'CREATE INDEX idx_potential_customers_instagram ON potential_customers (instagram)',
  'SELECT 1'
);

PREPARE stmt FROM @potential_customers_instagram_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_potential_customers_lead_status := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'potential_customers'
    AND COLUMN_NAME = 'lead_status'
);

SET @potential_customers_lead_status_sql := IF(
  @has_potential_customers_lead_status = 0,
  "ALTER TABLE potential_customers ADD COLUMN lead_status ENUM('NEW','CONTACTED','QUALIFIED','ARCHIVED') NOT NULL DEFAULT 'NEW' AFTER source",
  'SELECT 1'
);

PREPARE stmt FROM @potential_customers_lead_status_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_potential_customers_admin_notes := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'potential_customers'
    AND COLUMN_NAME = 'admin_notes'
);

SET @potential_customers_admin_notes_sql := IF(
  @has_potential_customers_admin_notes = 0,
  "ALTER TABLE potential_customers ADD COLUMN admin_notes TEXT NULL AFTER lead_status",
  'SELECT 1'
);

PREPARE stmt FROM @potential_customers_admin_notes_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_potential_customers_lead_status_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'potential_customers'
    AND INDEX_NAME = 'idx_potential_customers_lead_status'
);

SET @potential_customers_lead_status_idx_sql := IF(
  @has_potential_customers_lead_status_idx = 0,
  'CREATE INDEX idx_potential_customers_lead_status ON potential_customers (lead_status)',
  'SELECT 1'
);

PREPARE stmt FROM @potential_customers_lead_status_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_lead_preferences := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'lead_preferences'
);

SET @lead_preferences_sql := IF(
  @has_lead_preferences = 0,
  'CREATE TABLE lead_preferences (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    potential_customer_id BIGINT UNSIGNED NOT NULL,
    preferred_categories_json JSON NULL,
    preferred_brands_json JSON NULL,
    preferred_sizes_json JSON NULL,
    preferred_colors_json JSON NULL,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_lead_preferences_potential_customer_id (potential_customer_id),
    CONSTRAINT fk_lead_preferences_potential_customer FOREIGN KEY (potential_customer_id) REFERENCES potential_customers(id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB',
  'SELECT 1'
);

PREPARE stmt FROM @lead_preferences_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_article_interest_alerts := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'article_interest_alerts'
);

SET @article_interest_alerts_sql := IF(
  @has_article_interest_alerts = 0,
  'CREATE TABLE article_interest_alerts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    article_id BIGINT UNSIGNED NULL,
    potential_customer_id BIGINT UNSIGNED NOT NULL,
    alert_type ENUM(''BACK_IN_STOCK'',''SIMILAR_ITEMS'',''PRICE_OR_OFFER'',''NEW_ARRIVALS'') NOT NULL,
    status ENUM(''ACTIVE'',''PAUSED'',''CONVERTED'',''CANCELLED'') NOT NULL DEFAULT ''ACTIVE'',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_article_interest_alerts_article_id (article_id),
    KEY idx_article_interest_alerts_potential_customer_id (potential_customer_id),
    KEY idx_article_interest_alerts_status (status),
    CONSTRAINT fk_article_interest_alerts_article FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_article_interest_alerts_potential_customer FOREIGN KEY (potential_customer_id) REFERENCES potential_customers(id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB',
  'SELECT 1'
);

PREPARE stmt FROM @article_interest_alerts_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_wishlists := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'wishlists'
);

SET @wishlists_sql := IF(
  @has_wishlists = 0,
  'CREATE TABLE wishlists (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_id BIGINT UNSIGNED NULL,
    potential_customer_id BIGINT UNSIGNED NULL,
    session_token VARCHAR(120) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_wishlists_customer_id (customer_id),
    KEY idx_wishlists_potential_customer_id (potential_customer_id),
    KEY idx_wishlists_session_token (session_token),
    CONSTRAINT fk_wishlists_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_wishlists_potential_customer FOREIGN KEY (potential_customer_id) REFERENCES potential_customers(id) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB',
  'SELECT 1'
);

PREPARE stmt FROM @wishlists_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_wishlist_items := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'wishlist_items'
);

SET @wishlist_items_sql := IF(
  @has_wishlist_items = 0,
  'CREATE TABLE wishlist_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    wishlist_id BIGINT UNSIGNED NOT NULL,
    article_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_wishlist_items_wishlist_article (wishlist_id, article_id),
    KEY idx_wishlist_items_article_id (article_id),
    CONSTRAINT fk_wishlist_items_wishlist FOREIGN KEY (wishlist_id) REFERENCES wishlists(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_wishlist_items_article FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB',
  'SELECT 1'
);

PREPARE stmt FROM @wishlist_items_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_article_events := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'article_events'
);

SET @article_events_sql := IF(
  @has_article_events = 0,
  'CREATE TABLE article_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    article_id BIGINT UNSIGNED NULL,
    event_type ENUM(''VIEW'',''SHARE'',''ADD_TO_CART'',''OFFER_CLICK'',''CHECKOUT_START'',''WISHLIST_ADD'',''STOCK_ALERT'') NOT NULL,
    session_token VARCHAR(120) NULL,
    customer_id BIGINT UNSIGNED NULL,
    potential_customer_id BIGINT UNSIGNED NULL,
    metadata_json JSON NULL,
    ip_address VARCHAR(64) NULL,
    user_agent VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_article_events_customer_id (customer_id),
    KEY idx_article_events_potential_customer_id (potential_customer_id),
    KEY idx_article_events_session_token (session_token),
    CONSTRAINT fk_article_events_article FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_article_events_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_article_events_potential_customer FOREIGN KEY (potential_customer_id) REFERENCES potential_customers(id) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB',
  'SELECT 1'
);

PREPARE stmt FROM @article_events_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_article_events_main_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'article_events'
    AND INDEX_NAME = 'idx_article_events_article_event_created'
);

SET @article_events_main_idx_sql := IF(
  @has_article_events_main_idx = 0,
  'CREATE INDEX idx_article_events_article_event_created ON article_events (article_id, event_type, created_at)',
  'SELECT 1'
);

PREPARE stmt FROM @article_events_main_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_site_pages_seo := (
  SELECT COUNT(*)
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'site_pages_seo'
);

SET @site_pages_seo_sql := IF(
  @has_site_pages_seo = 0,
  'CREATE TABLE site_pages_seo (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    route VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description VARCHAR(500) NOT NULL,
    canonical_url VARCHAR(500) NULL,
    og_image VARCHAR(500) NULL,
    is_indexable TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_site_pages_seo_route (route)
  ) ENGINE=InnoDB',
  'SELECT 1'
);

PREPARE stmt FROM @site_pages_seo_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO site_pages_seo (route, title, description, canonical_url, og_image, is_indexable)
SELECT
  '/',
  'ESADAR | Ropa second hand seleccionada',
  'Sportswear, vintage y prendas modernas elegidas una por una. Stock limitado y piezas unicas.',
  NULL,
  NULL,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM site_pages_seo WHERE route = '/'
);

INSERT INTO site_pages_seo (route, title, description, canonical_url, og_image, is_indexable)
SELECT
  '/about',
  'Sobre ESADAR | Curaduria second hand',
  'Conoce la seleccion second hand de ESADAR: prendas unicas, sportswear, vintage y ropa moderna elegida con criterio.',
  NULL,
  NULL,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM site_pages_seo WHERE route = '/about'
);

INSERT INTO site_pages_seo (route, title, description, canonical_url, og_image, is_indexable)
SELECT
  '/contact',
  'Contacto | ESADAR',
  'Consultanos por una prenda, talles, ingresos nuevos o formas de entrega.',
  NULL,
  NULL,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM site_pages_seo WHERE route = '/contact'
);
