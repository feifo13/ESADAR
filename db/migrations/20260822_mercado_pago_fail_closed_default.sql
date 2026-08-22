-- Mercado Pago must be opt-in by default.
-- Existing company configuration values are preserved.

SET @mp_enabled_default := (
  SELECT CAST(column_default AS CHAR)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'company_collecting_settings'
    AND column_name = 'is_mercado_pago_enabled'
  LIMIT 1
);

SET @mp_default_sql := IF(
  COALESCE(@mp_enabled_default, '') = '0',
  'SELECT 1',
  'ALTER TABLE company_collecting_settings MODIFY COLUMN is_mercado_pago_enabled TINYINT(1) NOT NULL DEFAULT 0'
);

PREPARE mp_default_stmt
  FROM @mp_default_sql;

EXECUTE mp_default_stmt;

DEALLOCATE PREPARE
  mp_default_stmt;
