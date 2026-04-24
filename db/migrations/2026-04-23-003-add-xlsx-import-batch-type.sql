SET @has_xlsx_batch_type := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'article_import_batches'
    AND COLUMN_NAME = 'batch_type'
    AND COLUMN_TYPE LIKE '%''XLSX''%'
);

SET @article_import_batch_type_sql := IF(
  @has_xlsx_batch_type = 0,
  "ALTER TABLE article_import_batches MODIFY COLUMN batch_type ENUM('CSV','XLSX','MANUAL_BATCH') NOT NULL",
  'SELECT 1'
);

PREPARE article_import_batch_type_stmt FROM @article_import_batch_type_sql;
EXECUTE article_import_batch_type_stmt;
DEALLOCATE PREPARE article_import_batch_type_stmt;
