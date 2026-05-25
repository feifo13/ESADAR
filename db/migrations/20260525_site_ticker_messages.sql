-- Adds multiple message support for the administrable public site ticker.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET collation_connection = 'utf8mb4_unicode_ci';

SET @current_schema := DATABASE();

SET @has_site_ticker_table := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = @current_schema
    AND TABLE_NAME = 'site_ticker_settings'
);

SET @has_site_ticker_messages := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @current_schema
    AND TABLE_NAME = 'site_ticker_settings'
    AND COLUMN_NAME = 'ticker_messages'
);

SET @add_site_ticker_messages_sql := IF(
  @has_site_ticker_table > 0 AND @has_site_ticker_messages = 0,
  'ALTER TABLE site_ticker_settings ADD COLUMN ticker_messages JSON NULL AFTER ticker_text',
  'SELECT ''site_ticker_settings.ticker_messages already exists or table is missing'' AS info'
);

PREPARE add_site_ticker_messages_stmt FROM @add_site_ticker_messages_sql;
EXECUTE add_site_ticker_messages_stmt;
DEALLOCATE PREPARE add_site_ticker_messages_stmt;

SET @has_site_ticker_messages_after := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @current_schema
    AND TABLE_NAME = 'site_ticker_settings'
    AND COLUMN_NAME = 'ticker_messages'
);

SET @backfill_site_ticker_messages_sql := IF(
  @has_site_ticker_table > 0 AND @has_site_ticker_messages_after > 0,
  'UPDATE site_ticker_settings SET ticker_messages = JSON_ARRAY(ticker_text) WHERE ticker_messages IS NULL AND NULLIF(TRIM(ticker_text), '''') IS NOT NULL',
  'SELECT ''site_ticker_settings.ticker_messages backfill skipped'' AS info'
);

PREPARE backfill_site_ticker_messages_stmt FROM @backfill_site_ticker_messages_sql;
EXECUTE backfill_site_ticker_messages_stmt;
DEALLOCATE PREPARE backfill_site_ticker_messages_stmt;
