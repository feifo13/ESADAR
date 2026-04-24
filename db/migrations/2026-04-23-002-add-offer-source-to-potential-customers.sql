USE secondhand_store_v1;

SET @current_column_type := (
  SELECT COLUMN_TYPE
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'potential_customers'
    AND column_name = 'source'
);

SET @alter_sql := IF(
  @current_column_type LIKE '%''OFFER''%',
  'SELECT 1',
  "ALTER TABLE potential_customers MODIFY COLUMN source ENUM('CHECKOUT','CONTACT_FORM','MANUAL','OFFER') NOT NULL DEFAULT 'CHECKOUT'"
);

PREPARE stmt FROM @alter_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
