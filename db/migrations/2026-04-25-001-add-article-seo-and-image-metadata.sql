USE secondhand_store_v1;

SET @has_articles_seo_title := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'articles'
    AND COLUMN_NAME = 'seo_title'
);

SET @articles_seo_title_sql := IF(
  @has_articles_seo_title = 0,
  "ALTER TABLE articles ADD COLUMN seo_title VARCHAR(255) NULL AFTER title",
  'SELECT 1'
);

PREPARE stmt FROM @articles_seo_title_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_articles_seo_description := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'articles'
    AND COLUMN_NAME = 'seo_description'
);

SET @articles_seo_description_sql := IF(
  @has_articles_seo_description = 0,
  "ALTER TABLE articles ADD COLUMN seo_description VARCHAR(500) NULL AFTER seo_title",
  'SELECT 1'
);

PREPARE stmt FROM @articles_seo_description_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_articles_google_product_category := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'articles'
    AND COLUMN_NAME = 'google_product_category'
);

SET @articles_google_product_category_sql := IF(
  @has_articles_google_product_category = 0,
  "ALTER TABLE articles ADD COLUMN google_product_category VARCHAR(255) NULL AFTER seo_description",
  'SELECT 1'
);

PREPARE stmt FROM @articles_google_product_category_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_articles_condition_label := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'articles'
    AND COLUMN_NAME = 'condition_label'
);

SET @articles_condition_label_sql := IF(
  @has_articles_condition_label = 0,
  "ALTER TABLE articles ADD COLUMN condition_label VARCHAR(120) NULL AFTER google_product_category",
  'SELECT 1'
);

PREPARE stmt FROM @articles_condition_label_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_articles_color := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'articles'
    AND COLUMN_NAME = 'color'
);

SET @articles_color_sql := IF(
  @has_articles_color = 0,
  "ALTER TABLE articles ADD COLUMN color VARCHAR(120) NULL AFTER condition_label",
  'SELECT 1'
);

PREPARE stmt FROM @articles_color_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_articles_material := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'articles'
    AND COLUMN_NAME = 'material'
);

SET @articles_material_sql := IF(
  @has_articles_material = 0,
  "ALTER TABLE articles ADD COLUMN material VARCHAR(120) NULL AFTER color",
  'SELECT 1'
);

PREPARE stmt FROM @articles_material_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_articles_gender := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'articles'
    AND COLUMN_NAME = 'gender'
);

SET @articles_gender_sql := IF(
  @has_articles_gender = 0,
  "ALTER TABLE articles ADD COLUMN gender ENUM('UNISEX','HOMBRE','MUJER','NIÑO','NIÑA','OTRO') NULL AFTER material",
  'SELECT 1'
);

PREPARE stmt FROM @articles_gender_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_articles_age_group := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'articles'
    AND COLUMN_NAME = 'age_group'
);

SET @articles_age_group_sql := IF(
  @has_articles_age_group = 0,
  "ALTER TABLE articles ADD COLUMN age_group ENUM('ADULT','KIDS','TODDLER','INFANT','NEWBORN') NULL AFTER gender",
  'SELECT 1'
);

PREPARE stmt FROM @articles_age_group_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_articles_image_alt_override := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'articles'
    AND COLUMN_NAME = 'image_alt_override'
);

SET @articles_image_alt_override_sql := IF(
  @has_articles_image_alt_override = 0,
  "ALTER TABLE articles ADD COLUMN image_alt_override VARCHAR(255) NULL AFTER age_group",
  'SELECT 1'
);

PREPARE stmt FROM @articles_image_alt_override_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_articles_canonical_url := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'articles'
    AND COLUMN_NAME = 'canonical_url'
);

SET @articles_canonical_url_sql := IF(
  @has_articles_canonical_url = 0,
  "ALTER TABLE articles ADD COLUMN canonical_url VARCHAR(500) NULL AFTER image_alt_override",
  'SELECT 1'
);

PREPARE stmt FROM @articles_canonical_url_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_articles_status_intake_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'articles'
    AND INDEX_NAME = 'idx_articles_status_intake_date'
);

SET @articles_status_intake_idx_sql := IF(
  @has_articles_status_intake_idx = 0,
  'CREATE INDEX idx_articles_status_intake_date ON articles (status, intake_date)',
  'SELECT 1'
);

PREPARE stmt FROM @articles_status_intake_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_articles_category_status_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'articles'
    AND INDEX_NAME = 'idx_articles_category_status'
);

SET @articles_category_status_idx_sql := IF(
  @has_articles_category_status_idx = 0,
  'CREATE INDEX idx_articles_category_status ON articles (category_id, status)',
  'SELECT 1'
);

PREPARE stmt FROM @articles_category_status_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_articles_brand_status_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'articles'
    AND INDEX_NAME = 'idx_articles_brand_status'
);

SET @articles_brand_status_idx_sql := IF(
  @has_articles_brand_status_idx = 0,
  'CREATE INDEX idx_articles_brand_status ON articles (brand_id, status)',
  'SELECT 1'
);

PREPARE stmt FROM @articles_brand_status_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_article_images_original_file_path := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'article_images'
    AND COLUMN_NAME = 'original_file_path'
);

SET @article_images_original_file_path_sql := IF(
  @has_article_images_original_file_path = 0,
  "ALTER TABLE article_images ADD COLUMN original_file_path VARCHAR(500) NULL AFTER file_path",
  'SELECT 1'
);

PREPARE stmt FROM @article_images_original_file_path_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_article_images_thumb_file_path := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'article_images'
    AND COLUMN_NAME = 'thumb_file_path'
);

SET @article_images_thumb_file_path_sql := IF(
  @has_article_images_thumb_file_path = 0,
  "ALTER TABLE article_images ADD COLUMN thumb_file_path VARCHAR(500) NULL AFTER original_file_path",
  'SELECT 1'
);

PREPARE stmt FROM @article_images_thumb_file_path_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_article_images_card_file_path := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'article_images'
    AND COLUMN_NAME = 'card_file_path'
);

SET @article_images_card_file_path_sql := IF(
  @has_article_images_card_file_path = 0,
  "ALTER TABLE article_images ADD COLUMN card_file_path VARCHAR(500) NULL AFTER thumb_file_path",
  'SELECT 1'
);

PREPARE stmt FROM @article_images_card_file_path_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_article_images_detail_file_path := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'article_images'
    AND COLUMN_NAME = 'detail_file_path'
);

SET @article_images_detail_file_path_sql := IF(
  @has_article_images_detail_file_path = 0,
  "ALTER TABLE article_images ADD COLUMN detail_file_path VARCHAR(500) NULL AFTER card_file_path",
  'SELECT 1'
);

PREPARE stmt FROM @article_images_detail_file_path_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_article_images_zoom_file_path := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'article_images'
    AND COLUMN_NAME = 'zoom_file_path'
);

SET @article_images_zoom_file_path_sql := IF(
  @has_article_images_zoom_file_path = 0,
  "ALTER TABLE article_images ADD COLUMN zoom_file_path VARCHAR(500) NULL AFTER detail_file_path",
  'SELECT 1'
);

PREPARE stmt FROM @article_images_zoom_file_path_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_article_images_width := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'article_images'
    AND COLUMN_NAME = 'width'
);

SET @article_images_width_sql := IF(
  @has_article_images_width = 0,
  "ALTER TABLE article_images ADD COLUMN width INT NULL AFTER zoom_file_path",
  'SELECT 1'
);

PREPARE stmt FROM @article_images_width_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_article_images_height := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'article_images'
    AND COLUMN_NAME = 'height'
);

SET @article_images_height_sql := IF(
  @has_article_images_height = 0,
  "ALTER TABLE article_images ADD COLUMN height INT NULL AFTER width",
  'SELECT 1'
);

PREPARE stmt FROM @article_images_height_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_article_images_mime_type := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'article_images'
    AND COLUMN_NAME = 'mime_type'
);

SET @article_images_mime_type_sql := IF(
  @has_article_images_mime_type = 0,
  "ALTER TABLE article_images ADD COLUMN mime_type VARCHAR(100) NULL AFTER height",
  'SELECT 1'
);

PREPARE stmt FROM @article_images_mime_type_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_article_images_file_size_bytes := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'article_images'
    AND COLUMN_NAME = 'file_size_bytes'
);

SET @article_images_file_size_bytes_sql := IF(
  @has_article_images_file_size_bytes = 0,
  "ALTER TABLE article_images ADD COLUMN file_size_bytes BIGINT UNSIGNED NULL AFTER mime_type",
  'SELECT 1'
);

PREPARE stmt FROM @article_images_file_size_bytes_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_article_images_dominant_color := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'article_images'
    AND COLUMN_NAME = 'dominant_color'
);

SET @article_images_dominant_color_sql := IF(
  @has_article_images_dominant_color = 0,
  "ALTER TABLE article_images ADD COLUMN dominant_color VARCHAR(20) NULL AFTER file_size_bytes",
  'SELECT 1'
);

PREPARE stmt FROM @article_images_dominant_color_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_article_images_processed_status := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'article_images'
    AND COLUMN_NAME = 'processed_status'
);

SET @article_images_processed_status_sql := IF(
  @has_article_images_processed_status = 0,
  "ALTER TABLE article_images ADD COLUMN processed_status ENUM('PENDING','DONE','FAILED') NOT NULL DEFAULT 'DONE' AFTER dominant_color",
  'SELECT 1'
);

PREPARE stmt FROM @article_images_processed_status_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_article_images_processing_error := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'article_images'
    AND COLUMN_NAME = 'processing_error'
);

SET @article_images_processing_error_sql := IF(
  @has_article_images_processing_error = 0,
  "ALTER TABLE article_images ADD COLUMN processing_error TEXT NULL AFTER processed_status",
  'SELECT 1'
);

PREPARE stmt FROM @article_images_processing_error_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_article_images_primary_sort_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'article_images'
    AND INDEX_NAME = 'idx_article_images_article_primary_sort'
);

SET @article_images_primary_sort_idx_sql := IF(
  @has_article_images_primary_sort_idx = 0,
  'CREATE INDEX idx_article_images_article_primary_sort ON article_images (article_id, is_primary, sort_order)',
  'SELECT 1'
);

PREPARE stmt FROM @article_images_primary_sort_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE article_images
SET
  original_file_path = COALESCE(original_file_path, file_path),
  thumb_file_path = COALESCE(thumb_file_path, file_path),
  card_file_path = COALESCE(card_file_path, file_path),
  detail_file_path = COALESCE(detail_file_path, file_path),
  zoom_file_path = COALESCE(zoom_file_path, file_path),
  processed_status = COALESCE(processed_status, 'DONE')
WHERE file_path IS NOT NULL;
