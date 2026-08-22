SET @uq_payments_provider_reference_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'payments'
    AND index_name = 'uq_payments_provider_name_reference'
);

SET @uq_payments_provider_reference_sql = IF(
  @uq_payments_provider_reference_exists = 0,
  'ALTER TABLE payments ADD UNIQUE KEY uq_payments_provider_name_reference (provider_name, provider_reference)',
  'SELECT 1'
);

PREPARE uq_payments_provider_reference_stmt
FROM @uq_payments_provider_reference_sql;

EXECUTE uq_payments_provider_reference_stmt;

DEALLOCATE PREPARE uq_payments_provider_reference_stmt;
