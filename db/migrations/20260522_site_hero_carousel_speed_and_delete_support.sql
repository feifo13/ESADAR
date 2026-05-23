SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET collation_connection = 'utf8mb4_unicode_ci';

SET @site_hero_has_carousel_speed := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'site_hero'
    AND COLUMN_NAME = 'carousel_speed_seconds'
);

SET @site_hero_add_carousel_speed_sql := IF(
  @site_hero_has_carousel_speed = 0,
  'ALTER TABLE site_hero ADD COLUMN carousel_speed_seconds INT UNSIGNED NOT NULL DEFAULT 54 AFTER hero_display_mode',
  'SELECT 1'
);

PREPARE site_hero_add_carousel_speed_stmt FROM @site_hero_add_carousel_speed_sql;
EXECUTE site_hero_add_carousel_speed_stmt;
DEALLOCATE PREPARE site_hero_add_carousel_speed_stmt;
