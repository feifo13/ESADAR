-- Adds an intermediate hero height mode for tablets and small laptops.
SET @site_hero_height_mode_column := (
  SELECT COLUMN_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'site_hero'
    AND COLUMN_NAME = 'hero_height_mode'
  LIMIT 1
);

SET @site_hero_height_mode_sql := IF(
  @site_hero_height_mode_column IS NOT NULL
    AND @site_hero_height_mode_column NOT LIKE '%TABLET_LAPTOP%',
  'ALTER TABLE site_hero MODIFY hero_height_mode ENUM(''HALF_SCREEN'',''TABLET_LAPTOP'',''FULL_SCREEN'',''CUSTOM'') NOT NULL DEFAULT ''HALF_SCREEN''',
  'SELECT ''site_hero.hero_height_mode already supports TABLET_LAPTOP'' AS info'
);

PREPARE site_hero_height_mode_stmt FROM @site_hero_height_mode_sql;
EXECUTE site_hero_height_mode_stmt;
DEALLOCATE PREPARE site_hero_height_mode_stmt;
