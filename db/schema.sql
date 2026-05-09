-- =========================================================
-- Second-hand curated store - MySQL schema v1
-- Catalog + checkout + backoffice + audit
-- =========================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE DATABASE IF NOT EXISTS secondhand_store_v1
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE secondhand_store_v1;

-- =========================================================
-- 1) Security / access
-- =========================================================

CREATE TABLE roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_code (code)
) ENGINE=InnoDB;

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  birth_date DATE NULL,
  email VARCHAR(255) NULL,
  password_hash VARCHAR(255) NULL,
  address VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  instagram VARCHAR(100) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_active (is_active),
  KEY idx_users_created_by (created_by),
  KEY idx_users_updated_by (updated_by),
  CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_users_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;


CREATE TABLE password_reset_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash VARCHAR(128) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  requested_ip VARCHAR(64) NULL,
  requested_user_agent VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_password_reset_tokens_token_hash (token_hash),
  KEY idx_password_reset_tokens_user_id (user_id),
  KEY idx_password_reset_tokens_expires_at (expires_at),
  KEY idx_password_reset_tokens_used_at (used_at),
  CONSTRAINT fk_password_reset_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE user_roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assigned_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_roles_user_role (user_id, role_id),
  KEY idx_user_roles_role_id (role_id),
  KEY idx_user_roles_assigned_by (assigned_by),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_user_roles_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- =========================================================
-- 2) Master tables
-- =========================================================

CREATE TABLE categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  description TEXT NULL,
  sort_order INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_slug (slug),
  UNIQUE KEY uq_categories_name (name),
  KEY idx_categories_active (is_active),
  KEY idx_categories_created_by (created_by),
  KEY idx_categories_updated_by (updated_by),
  CONSTRAINT fk_categories_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_categories_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE brands (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_brands_slug (slug),
  UNIQUE KEY uq_brands_name (name),
  KEY idx_brands_active (is_active),
  KEY idx_brands_created_by (created_by),
  KEY idx_brands_updated_by (updated_by),
  CONSTRAINT fk_brands_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_brands_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE sizes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  description VARCHAR(120) NULL,
  sort_order INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sizes_code (code),
  KEY idx_sizes_active (is_active)
) ENGINE=InnoDB;

CREATE TABLE shipping_methods (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  description VARCHAR(150) NOT NULL,
  base_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  instructions TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY idx_shipping_methods_active (is_active),
  KEY idx_shipping_methods_created_by (created_by),
  KEY idx_shipping_methods_updated_by (updated_by),
  CONSTRAINT chk_shipping_methods_base_cost CHECK (base_cost >= 0),
  CONSTRAINT fk_shipping_methods_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_shipping_methods_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- =========================================================
-- 3) Customers / prospects
-- =========================================================

CREATE TABLE customers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  birth_date DATE NULL,
  email VARCHAR(255) NULL,
  address VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  instagram VARCHAR(100) NULL,
  preferred_payment_method VARCHAR(80) NULL,
  preferred_shipping_method_id BIGINT UNSIGNED NULL,
  source ENUM('REGISTERED','GUEST_CHECKOUT','MANUAL_BACKOFFICE','CONTACT') NOT NULL DEFAULT 'GUEST_CHECKOUT',
  notes_internal TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY idx_customers_user_id (user_id),
  KEY idx_customers_email (email),
  KEY idx_customers_phone (phone),
  KEY idx_customers_active (is_active),
  KEY idx_customers_preferred_shipping_method_id (preferred_shipping_method_id),
  KEY idx_customers_created_by (created_by),
  KEY idx_customers_updated_by (updated_by),
  CONSTRAINT fk_customers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_customers_preferred_shipping_method FOREIGN KEY (preferred_shipping_method_id) REFERENCES shipping_methods(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_customers_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_customers_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE customer_addresses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  label VARCHAR(80) NULL,
  address_line VARCHAR(255) NOT NULL,
  city VARCHAR(120) NULL,
  state VARCHAR(120) NULL,
  country VARCHAR(120) NULL,
  postal_code VARCHAR(30) NULL,
  delivery_notes TEXT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_customer_addresses_customer_id (customer_id),
  KEY idx_customer_addresses_default (customer_id, is_default),
  CONSTRAINT fk_customer_addresses_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE potential_customers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  birth_date DATE NULL,
  email VARCHAR(255) NULL,
  address VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  instagram VARCHAR(100) NULL,
  source ENUM('CHECKOUT','CONTACT_FORM','MANUAL','OFFER','NEWSLETTER','STOCK_ALERT','WISHLIST','ABANDONED_CART','PRODUCT_INTEREST') NOT NULL DEFAULT 'CHECKOUT',
  lead_status ENUM('NEW','CONTACTED','QUALIFIED','ARCHIVED') NOT NULL DEFAULT 'NEW',
  admin_notes TEXT NULL,
  linked_customer_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_potential_customers_linked_customer_id (linked_customer_id),
  KEY idx_potential_customers_email (email),
  KEY idx_potential_customers_phone (phone),
  KEY idx_potential_customers_instagram (instagram),
  KEY idx_potential_customers_lead_status (lead_status),
  CONSTRAINT fk_potential_customers_linked_customer FOREIGN KEY (linked_customer_id) REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- =========================================================
-- 4) Catalog
-- =========================================================

CREATE TABLE articles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  internal_code VARCHAR(80) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  title VARCHAR(255) NOT NULL,
  seo_title VARCHAR(255) NULL,
  seo_description VARCHAR(500) NULL,
  google_product_category VARCHAR(255) NULL,
  condition_label VARCHAR(120) NULL,
  color VARCHAR(120) NULL,
  material VARCHAR(120) NULL,
  gender ENUM('UNISEX','HOMBRE','MUJER','NIÑO','NIÑA','OTRO') NULL,
  age_group ENUM('ADULT','KIDS','TODDLER','INFANT','NEWBORN') NULL,
  image_alt_override VARCHAR(255) NULL,
  canonical_url VARCHAR(500) NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  brand_id BIGINT UNSIGNED NULL,
  size_id BIGINT UNSIGNED NULL,
  size_text VARCHAR(80) NULL,
  measurements_text TEXT NULL,
  description TEXT NULL,
  purchase_price_item DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  purchase_price_shipping DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  purchase_price_courier DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  purchase_price_total DECIMAL(12,2)
    GENERATED ALWAYS AS (ROUND(COALESCE(purchase_price_item,0) + COALESCE(purchase_price_shipping,0) + COALESCE(purchase_price_courier,0), 2)) STORED,
  sale_price DECIMAL(12,2) NOT NULL,
  discount_type ENUM('NONE','PERCENT','FIXED') NOT NULL DEFAULT 'NONE',
  discount_value DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  discounted_price DECIMAL(12,2)
    GENERATED ALWAYS AS (
      CASE
        WHEN discount_type = 'NONE' THEN ROUND(sale_price, 2)
        WHEN discount_type = 'PERCENT' THEN ROUND(GREATEST(sale_price - ((sale_price * discount_value) / 100), 0), 2)
        WHEN discount_type = 'FIXED' THEN ROUND(GREATEST(sale_price - discount_value, 0), 2)
        ELSE ROUND(sale_price, 2)
      END
    ) STORED,
  allow_offers TINYINT(1) NOT NULL DEFAULT 0,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  intake_date DATE NOT NULL,
  quantity_total INT UNSIGNED NOT NULL DEFAULT 1,
  quantity_available INT UNSIGNED NOT NULL DEFAULT 1,
  quantity_reserved INT UNSIGNED NOT NULL DEFAULT 0,
  quantity_sold INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('ACTIVE','INACTIVE','RESERVED','SOLD_OUT') NOT NULL DEFAULT 'ACTIVE',
  origin_notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_articles_internal_code (internal_code),
  UNIQUE KEY uq_articles_slug (slug),
  KEY idx_articles_category_id (category_id),
  KEY idx_articles_brand_id (brand_id),
  KEY idx_articles_size_id (size_id),
  KEY idx_articles_status (status),
  KEY idx_articles_status_intake_date (status, intake_date),
  KEY idx_articles_category_status (category_id, status),
  KEY idx_articles_brand_status (brand_id, status),
  KEY idx_articles_featured (is_featured),
  KEY idx_articles_allow_offers (allow_offers),
  KEY idx_articles_intake_date (intake_date),
  KEY idx_articles_created_by (created_by),
  KEY idx_articles_updated_by (updated_by),
  CONSTRAINT chk_articles_sale_price CHECK (sale_price >= 0),
  CONSTRAINT chk_articles_discount_value CHECK (discount_value >= 0),
  CONSTRAINT chk_articles_purchase_price_item CHECK (purchase_price_item >= 0),
  CONSTRAINT chk_articles_purchase_price_shipping CHECK (purchase_price_shipping >= 0),
  CONSTRAINT chk_articles_purchase_price_courier CHECK (purchase_price_courier >= 0),
  CONSTRAINT chk_articles_quantity_balance CHECK (quantity_total >= quantity_available + quantity_reserved + quantity_sold),
  CONSTRAINT chk_articles_offers_vs_discount CHECK (NOT (allow_offers = 1 AND discount_type <> 'NONE' AND discount_value > 0)),
  CONSTRAINT fk_articles_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_articles_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_articles_size FOREIGN KEY (size_id) REFERENCES sizes(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_articles_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_articles_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE article_stock_movements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  article_id BIGINT UNSIGNED NOT NULL,
  movement_type ENUM('INITIAL','MANUAL_ADJUSTMENT','RESERVE','RELEASE_RESERVATION','SALE','CANCEL_ORDER','RETURN','LOSS') NOT NULL,
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
  KEY idx_article_stock_movements_article_id (article_id),
  KEY idx_article_stock_movements_order_id (order_id),
  KEY idx_article_stock_movements_type (movement_type),
  KEY idx_article_stock_movements_created_at (created_at)
) ENGINE=InnoDB;

CREATE TABLE article_images (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  article_id BIGINT UNSIGNED NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  original_file_path VARCHAR(500) NULL,
  thumb_file_path VARCHAR(500) NULL,
  card_file_path VARCHAR(500) NULL,
  detail_file_path VARCHAR(500) NULL,
  zoom_file_path VARCHAR(500) NULL,
  width INT NULL,
  height INT NULL,
  mime_type VARCHAR(100) NULL,
  file_size_bytes BIGINT UNSIGNED NULL,
  dominant_color VARCHAR(20) NULL,
  processed_status ENUM('PENDING','DONE','FAILED') NOT NULL DEFAULT 'DONE',
  processing_error TEXT NULL,
  alt_text VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_primary TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY idx_article_images_article_id (article_id),
  KEY idx_article_images_primary (article_id, is_primary),
  KEY idx_article_images_article_primary_sort (article_id, is_primary, sort_order),
  KEY idx_article_images_created_by (created_by),
  CONSTRAINT fk_article_images_article FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_article_images_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE article_import_batches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_type ENUM('CSV','XLSX','MANUAL_BATCH') NOT NULL,
  source_file_name VARCHAR(255) NULL,
  rows_received INT UNSIGNED NOT NULL DEFAULT 0,
  rows_created INT UNSIGNED NOT NULL DEFAULT 0,
  rows_updated INT UNSIGNED NOT NULL DEFAULT 0,
  rows_failed INT UNSIGNED NOT NULL DEFAULT 0,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,
  status ENUM('PROCESSING','DONE','DONE_WITH_ERRORS','FAILED') NOT NULL DEFAULT 'PROCESSING',
  notes TEXT NULL,
  created_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY idx_article_import_batches_status (status),
  KEY idx_article_import_batches_created_by (created_by),
  CONSTRAINT fk_article_import_batches_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE article_import_batch_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_id BIGINT UNSIGNED NOT NULL,
  import_row_number INT UNSIGNED NULL,
  article_id BIGINT UNSIGNED NULL,
  action ENUM('CREATED','UPDATED','FAILED','SKIPPED') NOT NULL,
  raw_payload_json JSON NULL,
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_article_import_batch_items_batch_id (batch_id),
  KEY idx_article_import_batch_items_article_id (article_id),
  CONSTRAINT fk_article_import_batch_items_batch FOREIGN KEY (batch_id) REFERENCES article_import_batches(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_article_import_batch_items_article FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- =========================================================
-- 5) Cart
-- =========================================================

CREATE TABLE carts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  customer_id BIGINT UNSIGNED NULL,
  session_token VARCHAR(120) NULL,
  status ENUM('ACTIVE','CONVERTED','ABANDONED','EXPIRED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_carts_session_token (session_token),
  KEY idx_carts_user_id (user_id),
  KEY idx_carts_customer_id (customer_id),
  KEY idx_carts_status (status),
  CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_carts_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE cart_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cart_id BIGINT UNSIGNED NOT NULL,
  article_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  unit_price_snapshot DECIMAL(12,2) NOT NULL,
  discount_type_snapshot ENUM('NONE','PERCENT','FIXED') NOT NULL DEFAULT 'NONE',
  discount_value_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  final_unit_price_snapshot DECIMAL(12,2) NOT NULL,
  accepted_offer_id BIGINT UNSIGNED NULL,
  accepted_offer_price_snapshot DECIMAL(12,2) NULL,
  accepted_offer_quantity_snapshot INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cart_items_cart_article (cart_id, article_id),
  KEY idx_cart_items_article_id (article_id),
  KEY idx_cart_items_accepted_offer_id (accepted_offer_id),
  CONSTRAINT chk_cart_items_quantity CHECK (quantity > 0),
  CONSTRAINT chk_cart_items_unit_price_snapshot CHECK (unit_price_snapshot >= 0),
  CONSTRAINT chk_cart_items_final_unit_price_snapshot CHECK (final_unit_price_snapshot >= 0),
  CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cart_items_article FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- =========================================================
-- 6) Orders
-- =========================================================

CREATE TABLE orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_number VARCHAR(50) NOT NULL,
  customer_id BIGINT UNSIGNED NULL,
  potential_customer_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NULL,
  shipping_method_id BIGINT UNSIGNED NULL,
  shipping_method_description_snapshot VARCHAR(150) NULL,
  shipping_cost_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_method ENUM('BANK_TRANSFER','MERCADO_PAGO') NOT NULL,
  payment_status ENUM('PENDING','PAID','FAILED','REFUNDED') NOT NULL DEFAULT 'PENDING',
  order_status ENUM('PENDING','RESERVED','APPROVED','SHIPPED','CANCELLED','EXPIRED') NOT NULL DEFAULT 'PENDING',
  subtotal_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  discount_total_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  reserved_until DATETIME NULL,
  approved_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  shipped_at DATETIME NULL,
  cancellation_reason TEXT NULL,
  internal_notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_order_number (order_number),
  KEY idx_orders_customer_id (customer_id),
  KEY idx_orders_potential_customer_id (potential_customer_id),
  KEY idx_orders_user_id (user_id),
  KEY idx_orders_shipping_method_id (shipping_method_id),
  KEY idx_orders_order_status (order_status),
  KEY idx_orders_payment_status (payment_status),
  KEY idx_orders_reserved_until (reserved_until),
  KEY idx_orders_created_at (created_at),
  KEY idx_orders_created_by (created_by),
  KEY idx_orders_updated_by (updated_by),
  CONSTRAINT chk_orders_shipping_cost_snapshot CHECK (shipping_cost_snapshot >= 0),
  CONSTRAINT chk_orders_subtotal_snapshot CHECK (subtotal_snapshot >= 0),
  CONSTRAINT chk_orders_discount_total_snapshot CHECK (discount_total_snapshot >= 0),
  CONSTRAINT chk_orders_total_snapshot CHECK (total_snapshot >= 0),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_orders_potential_customer FOREIGN KEY (potential_customer_id) REFERENCES potential_customers(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_orders_shipping_method FOREIGN KEY (shipping_method_id) REFERENCES shipping_methods(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_orders_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_orders_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  article_id BIGINT UNSIGNED NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  article_title_snapshot VARCHAR(255) NOT NULL,
  article_slug_snapshot VARCHAR(180) NULL,
  category_name_snapshot VARCHAR(120) NULL,
  brand_name_snapshot VARCHAR(120) NULL,
  size_snapshot VARCHAR(80) NULL,
  measurements_snapshot TEXT NULL,
  image_snapshot VARCHAR(500) NULL,
  sale_price_snapshot DECIMAL(12,2) NOT NULL,
  discount_type_snapshot ENUM('NONE','PERCENT','FIXED') NOT NULL DEFAULT 'NONE',
  discount_value_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  final_unit_price_snapshot DECIMAL(12,2) NOT NULL,
  line_total_snapshot DECIMAL(12,2) NOT NULL,
  purchase_price_item_snapshot DECIMAL(12,2) NULL,
  purchase_price_shipping_snapshot DECIMAL(12,2) NULL,
  purchase_price_courier_snapshot DECIMAL(12,2) NULL,
  purchase_price_total_snapshot DECIMAL(12,2) NULL,
  profit_snapshot DECIMAL(12,2) NULL,
  accepted_offer_id BIGINT UNSIGNED NULL,
  accepted_offer_price_snapshot DECIMAL(12,2) NULL,
  accepted_offer_quantity_snapshot INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_items_order_id (order_id),
  KEY idx_order_items_article_id (article_id),
  KEY idx_order_items_accepted_offer_id (accepted_offer_id),
  CONSTRAINT chk_order_items_quantity CHECK (quantity > 0),
  CONSTRAINT chk_order_items_sale_price_snapshot CHECK (sale_price_snapshot >= 0),
  CONSTRAINT chk_order_items_final_unit_price_snapshot CHECK (final_unit_price_snapshot >= 0),
  CONSTRAINT chk_order_items_line_total_snapshot CHECK (line_total_snapshot >= 0),
  CONSTRAINT chk_order_items_purchase_price_item_snapshot CHECK (purchase_price_item_snapshot IS NULL OR purchase_price_item_snapshot >= 0),
  CONSTRAINT chk_order_items_purchase_price_shipping_snapshot CHECK (purchase_price_shipping_snapshot IS NULL OR purchase_price_shipping_snapshot >= 0),
  CONSTRAINT chk_order_items_purchase_price_courier_snapshot CHECK (purchase_price_courier_snapshot IS NULL OR purchase_price_courier_snapshot >= 0),
  CONSTRAINT chk_order_items_purchase_price_total_snapshot CHECK (purchase_price_total_snapshot IS NULL OR purchase_price_total_snapshot >= 0),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_order_items_article FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE order_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  from_status ENUM('PENDING','RESERVED','APPROVED','SHIPPED','CANCELLED','EXPIRED') NULL,
  to_status ENUM('PENDING','RESERVED','APPROVED','SHIPPED','CANCELLED','EXPIRED') NOT NULL,
  reason TEXT NULL,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changed_by BIGINT UNSIGNED NULL,
  source ENUM('BACKOFFICE','FRONTEND','SYSTEM','API') NOT NULL DEFAULT 'SYSTEM',
  PRIMARY KEY (id),
  KEY idx_order_status_history_order_id (order_id),
  KEY idx_order_status_history_changed_by (changed_by),
  KEY idx_order_status_history_changed_at (changed_at),
  CONSTRAINT fk_order_status_history_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_order_status_history_changed_by FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- =========================================================
-- 7) Offers
-- =========================================================

CREATE TABLE offers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  article_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NULL,
  potential_customer_id BIGINT UNSIGNED NULL,
  offered_price DECIMAL(12,2) NOT NULL,
  currency_code CHAR(3) NOT NULL DEFAULT 'UYU',
  status ENUM('PENDING','ACCEPTED','REJECTED','EXPIRED','CANCELLED','USED') NOT NULL DEFAULT 'PENDING',
  expires_at DATETIME NULL,
  accepted_at DATETIME NULL,
  rejected_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  consumed_at DATETIME NULL,
  consumed_order_id BIGINT UNSIGNED NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY idx_offers_article_id (article_id),
  KEY idx_offers_customer_id (customer_id),
  KEY idx_offers_potential_customer_id (potential_customer_id),
  KEY idx_offers_status (status),
  KEY idx_offers_expires_at (expires_at),
  KEY idx_offers_created_by (created_by),
  KEY idx_offers_consumed_order_id (consumed_order_id),
  KEY idx_offers_updated_by (updated_by),
  CONSTRAINT chk_offers_offered_price CHECK (offered_price > 0),
  CONSTRAINT fk_offers_article FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_offers_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_offers_potential_customer FOREIGN KEY (potential_customer_id) REFERENCES potential_customers(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_offers_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_offers_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_offers_consumed_order FOREIGN KEY (consumed_order_id) REFERENCES orders(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE offer_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  offer_id BIGINT UNSIGNED NOT NULL,
  from_status ENUM('PENDING','ACCEPTED','REJECTED','EXPIRED','CANCELLED','USED') NULL,
  to_status ENUM('PENDING','ACCEPTED','REJECTED','EXPIRED','CANCELLED','USED') NOT NULL,
  reason TEXT NULL,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changed_by BIGINT UNSIGNED NULL,
  source ENUM('BACKOFFICE','FRONTEND','SYSTEM','API') NOT NULL DEFAULT 'SYSTEM',
  PRIMARY KEY (id),
  KEY idx_offer_status_history_offer_id (offer_id),
  KEY idx_offer_status_history_changed_by (changed_by),
  KEY idx_offer_status_history_changed_at (changed_at),
  CONSTRAINT fk_offer_status_history_offer FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_offer_status_history_changed_by FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

ALTER TABLE cart_items
  ADD CONSTRAINT fk_cart_items_accepted_offer FOREIGN KEY (accepted_offer_id) REFERENCES offers(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE order_items
  ADD CONSTRAINT fk_order_items_accepted_offer FOREIGN KEY (accepted_offer_id) REFERENCES offers(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- =========================================================
-- 8) Payments
-- =========================================================

CREATE TABLE payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  payment_method ENUM('BANK_TRANSFER','MERCADO_PAGO') NOT NULL,
  provider_name VARCHAR(100) NULL,
  provider_reference VARCHAR(150) NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency_code CHAR(3) NOT NULL DEFAULT 'UYU',
  status ENUM('PENDING','APPROVED','REJECTED','FAILED','REFUNDED') NOT NULL DEFAULT 'PENDING',
  paid_at DATETIME NULL,
  raw_response_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY idx_payments_order_id (order_id),
  KEY idx_payments_status (status),
  KEY idx_payments_provider_reference (provider_reference),
  KEY idx_payments_created_by (created_by),
  KEY idx_payments_updated_by (updated_by),
  CONSTRAINT chk_payments_amount CHECK (amount >= 0),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_payments_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_payments_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- =========================================================
-- 9) Contact / leads
-- =========================================================

CREATE TABLE contact_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  birth_date DATE NULL,
  phone VARCHAR(50) NULL,
  instagram VARCHAR(100) NULL,
  email VARCHAR(255) NULL,
  message_text TEXT NOT NULL,
  status ENUM('NEW','READ','REPLIED','ARCHIVED') NOT NULL DEFAULT 'NEW',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  handled_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY idx_contact_messages_status (status),
  KEY idx_contact_messages_handled_by (handled_by),
  CONSTRAINT fk_contact_messages_handled_by FOREIGN KEY (handled_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- =========================================================
-- 10) Leads / wishlist / article events
-- =========================================================

CREATE TABLE lead_preferences (
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
) ENGINE=InnoDB;

CREATE TABLE article_interest_alerts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  article_id BIGINT UNSIGNED NULL,
  potential_customer_id BIGINT UNSIGNED NOT NULL,
  alert_type ENUM('BACK_IN_STOCK','SIMILAR_ITEMS','PRICE_OR_OFFER','NEW_ARRIVALS') NOT NULL,
  status ENUM('ACTIVE','PAUSED','CONVERTED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_article_interest_alerts_article_id (article_id),
  KEY idx_article_interest_alerts_potential_customer_id (potential_customer_id),
  KEY idx_article_interest_alerts_status (status),
  CONSTRAINT fk_article_interest_alerts_article FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_article_interest_alerts_potential_customer FOREIGN KEY (potential_customer_id) REFERENCES potential_customers(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE wishlists (
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
) ENGINE=InnoDB;

CREATE TABLE wishlist_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  wishlist_id BIGINT UNSIGNED NOT NULL,
  article_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wishlist_items_wishlist_article (wishlist_id, article_id),
  KEY idx_wishlist_items_article_id (article_id),
  CONSTRAINT fk_wishlist_items_wishlist FOREIGN KEY (wishlist_id) REFERENCES wishlists(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_wishlist_items_article FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE article_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  article_id BIGINT UNSIGNED NULL,
  event_type ENUM('VIEW','SHARE','ADD_TO_CART','OFFER_CLICK','CHECKOUT_START','WISHLIST_ADD','STOCK_ALERT') NOT NULL,
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
  KEY idx_article_events_article_event_created (article_id, event_type, created_at),
  CONSTRAINT fk_article_events_article FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_article_events_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_article_events_potential_customer FOREIGN KEY (potential_customer_id) REFERENCES potential_customers(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- =========================================================
-- 11) SEO / site pages
-- =========================================================

CREATE TABLE site_pages_seo (
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
) ENGINE=InnoDB;

-- =========================================================
-- 12) Central audit log
-- =========================================================

CREATE TABLE audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_user_id BIGINT UNSIGNED NULL,
  actor_label VARCHAR(150) NULL,
  action_code VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  metadata_json JSON NULL,
  source ENUM('BACKOFFICE','FRONTEND','SYSTEM','API') NOT NULL DEFAULT 'SYSTEM',
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_log_actor_user_id (actor_user_id),
  KEY idx_audit_log_action_code (action_code),
  KEY idx_audit_log_entity (entity_type, entity_id),
  KEY idx_audit_log_source (source),
  KEY idx_audit_log_created_at (created_at),
  CONSTRAINT fk_audit_log_actor_user FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- =========================================================
-- 13) Helpful seeds
-- =========================================================

INSERT INTO roles (code, name) VALUES
  ('SUPER_ADMIN', 'Super Admin'),
  ('ADMIN', 'Admin'),
  ('OPERATOR', 'Operator'),
  ('CUSTOMER', 'Customer')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO sizes (code, description, sort_order) VALUES
  ('XS', 'Extra Small', 10),
  ('S', 'Small', 20),
  ('M', 'Medium', 30),
  ('L', 'Large', 40),
  ('XL', 'Extra Large', 50),
  ('XXL', 'Double Extra Large', 60),
  ('UNICO', 'Talle único', 70),
  ('36', '36', 80),
  ('38', '38', 90),
  ('40', '40', 100),
  ('42', '42', 110)
ON DUPLICATE KEY UPDATE description = VALUES(description), sort_order = VALUES(sort_order);

INSERT INTO site_pages_seo (route, title, description, canonical_url, og_image, is_indexable) VALUES
  ('/', 'ESADAR | Ropa seleccionada', 'Sportswear, vintage y prendas modernas elegidas una por una. Stock limitado y piezas unicas.', NULL, NULL, 1),
  ('/about', 'Sobre ESADAR | Curaduria', 'Conoce la seleccion de ESADAR: prendas unicas, sportswear, vintage y ropa moderna elegida con criterio.', NULL, NULL, 1),
  ('/contact', 'Contacto | ESADAR', 'Consultanos por una prenda, talles, ingresos nuevos o formas de entrega.', NULL, NULL, 1)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  description = VALUES(description),
  canonical_url = VALUES(canonical_url),
  og_image = VALUES(og_image),
  is_indexable = VALUES(is_indexable);

-- =========================================================
-- Notes
-- =========================================================
-- 1) The generic audit trail should be written from the application service layer.
-- 2) Order and offer history tables should be populated on every valid state transition.
-- 3) Business rules like "discount blocks offers" should be enforced both here and in the backend.
-- 4) For article_images, the application should ensure only one primary image per article.


-- =========================================================
-- 14) Triggers for invariants that MySQL CHECK cannot enforce
-- =========================================================

DELIMITER $$

CREATE TRIGGER trg_orders_bi_actor_presence
BEFORE INSERT ON orders
FOR EACH ROW
BEGIN
  IF NEW.customer_id IS NULL AND NEW.potential_customer_id IS NULL AND NEW.user_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'orders requires customer_id, potential_customer_id, or user_id';
  END IF;
END$$

CREATE TRIGGER trg_orders_bu_actor_presence
BEFORE UPDATE ON orders
FOR EACH ROW
BEGIN
  IF NEW.customer_id IS NULL AND NEW.potential_customer_id IS NULL AND NEW.user_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'orders requires customer_id, potential_customer_id, or user_id';
  END IF;
END$$

CREATE TRIGGER trg_offers_bi_actor_presence
BEFORE INSERT ON offers
FOR EACH ROW
BEGIN
  IF NEW.customer_id IS NULL AND NEW.potential_customer_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'offers requires customer_id or potential_customer_id';
  END IF;
END$$

CREATE TRIGGER trg_offers_bu_actor_presence
BEFORE UPDATE ON offers
FOR EACH ROW
BEGIN
  IF NEW.customer_id IS NULL AND NEW.potential_customer_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'offers requires customer_id or potential_customer_id';
  END IF;
END$$

DELIMITER ;
