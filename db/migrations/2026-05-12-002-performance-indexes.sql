-- Incremental performance indexes for public gallery, cart sync, offers and admin lists.
-- Safe to run repeatedly: each index is created only if it does not already exist.

DELIMITER $$

DROP PROCEDURE IF EXISTS add_index_if_missing $$
CREATE PROCEDURE add_index_if_missing(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64),
  IN p_index_sql TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = p_table_name
      AND INDEX_NAME = p_index_name
  ) THEN
    SET @ddl := p_index_sql;
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DELIMITER ;

CALL add_index_if_missing(
  'articles',
  'idx_articles_public_gallery',
  'CREATE INDEX idx_articles_public_gallery ON articles (status, intake_date, id)'
);

CALL add_index_if_missing(
  'articles',
  'idx_articles_public_featured',
  'CREATE INDEX idx_articles_public_featured ON articles (status, is_featured, intake_date, id)'
);

CALL add_index_if_missing(
  'articles',
  'idx_articles_public_offerable',
  'CREATE INDEX idx_articles_public_offerable ON articles (status, allow_offers, intake_date, id)'
);

CALL add_index_if_missing(
  'articles',
  'idx_articles_public_price',
  'CREATE INDEX idx_articles_public_price ON articles (status, discounted_price, id)'
);

CALL add_index_if_missing(
  'carts',
  'idx_carts_user_status_id',
  'CREATE INDEX idx_carts_user_status_id ON carts (user_id, status, id)'
);

CALL add_index_if_missing(
  'cart_items',
  'idx_cart_items_cart_article_offer',
  'CREATE INDEX idx_cart_items_cart_article_offer ON cart_items (cart_id, article_id, accepted_offer_id)'
);

CALL add_index_if_missing(
  'orders',
  'idx_orders_user_status_created',
  'CREATE INDEX idx_orders_user_status_created ON orders (user_id, order_status, created_at)'
);

CALL add_index_if_missing(
  'orders',
  'idx_orders_status_payment_created',
  'CREATE INDEX idx_orders_status_payment_created ON orders (order_status, payment_status, created_at)'
);

CALL add_index_if_missing(
  'offers',
  'idx_offers_article_status_consumed',
  'CREATE INDEX idx_offers_article_status_consumed ON offers (article_id, status, consumed_at)'
);

CALL add_index_if_missing(
  'offers',
  'idx_offers_customer_status_accepted',
  'CREATE INDEX idx_offers_customer_status_accepted ON offers (customer_id, status, accepted_at)'
);

CALL add_index_if_missing(
  'users',
  'idx_users_active_created',
  'CREATE INDEX idx_users_active_created ON users (is_active, created_at)'
);

DROP PROCEDURE IF EXISTS add_index_if_missing;
