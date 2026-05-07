-- Allow the cart to keep separate lines for the same article when one line uses an accepted offer
-- and another line uses the regular article price.
--
-- Before accepted offers, cart_items enforced one row per (cart_id, article_id) with
-- uq_cart_items_cart_article. That blocks the business rule that an accepted offer applies
-- to 1 unit only while extra units of the same article remain as a separate normal line.

SET @has_cart_article_unique := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'cart_items'
    AND INDEX_NAME = 'uq_cart_items_cart_article'
);

SET @has_cart_article_index := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'cart_items'
    AND INDEX_NAME = 'idx_cart_items_cart_article'
);

SET @cart_article_index_sql := CASE
  WHEN @has_cart_article_unique > 0 AND @has_cart_article_index = 0 THEN
    'ALTER TABLE cart_items DROP INDEX uq_cart_items_cart_article, ADD KEY idx_cart_items_cart_article (cart_id, article_id)'
  WHEN @has_cart_article_unique > 0 AND @has_cart_article_index > 0 THEN
    'ALTER TABLE cart_items DROP INDEX uq_cart_items_cart_article'
  WHEN @has_cart_article_unique = 0 AND @has_cart_article_index = 0 THEN
    'ALTER TABLE cart_items ADD KEY idx_cart_items_cart_article (cart_id, article_id)'
  ELSE
    'SELECT 1'
END;

PREPARE stmt FROM @cart_article_index_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
