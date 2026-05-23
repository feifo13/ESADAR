SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET collation_connection = 'utf8mb4_unicode_ci';

SET @current_schema := DATABASE();

SET @has_viewport_target := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @current_schema
    AND TABLE_NAME = 'site_hero_images'
    AND COLUMN_NAME = 'viewport_target'
);

SET @add_viewport_target_sql := IF(
  @has_viewport_target = 0,
  'ALTER TABLE site_hero_images ADD COLUMN viewport_target ENUM(''DESKTOP_TABLET'',''MOBILE'') NOT NULL DEFAULT ''DESKTOP_TABLET'' AFTER image_alt',
  'SELECT ''site_hero_images.viewport_target already exists'' AS info'
);

PREPARE add_viewport_target_stmt FROM @add_viewport_target_sql;
EXECUTE add_viewport_target_stmt;
DEALLOCATE PREPARE add_viewport_target_stmt;

UPDATE site_hero_images
SET viewport_target = 'DESKTOP_TABLET'
WHERE viewport_target IS NULL;

SET @has_viewport_index := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @current_schema
    AND TABLE_NAME = 'site_hero_images'
    AND INDEX_NAME = 'idx_site_hero_images_viewport_active'
);

SET @add_viewport_index_sql := IF(
  @has_viewport_index = 0,
  'ALTER TABLE site_hero_images ADD INDEX idx_site_hero_images_viewport_active (hero_id, viewport_target, is_active, sort_order, id)',
  'SELECT ''site_hero_images viewport index already exists'' AS info'
);

PREPARE add_viewport_index_stmt FROM @add_viewport_index_sql;
EXECUTE add_viewport_index_stmt;
DEALLOCATE PREPARE add_viewport_index_stmt;
