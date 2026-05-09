-- Compatible con MySQL sin ADD COLUMN IF NOT EXISTS.

DROP PROCEDURE IF EXISTS migrate_configure_mercado_pago;

DELIMITER $$

CREATE PROCEDURE migrate_configure_mercado_pago()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'company_collecting_settings'
      AND COLUMN_NAME = 'mercado_pago_environment'
  ) THEN
    ALTER TABLE company_collecting_settings
      ADD COLUMN mercado_pago_environment ENUM('test','production') NOT NULL DEFAULT 'test'
      AFTER is_mercado_pago_enabled;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'company_collecting_settings'
      AND COLUMN_NAME = 'mercado_pago_notification_url'
  ) THEN
    ALTER TABLE company_collecting_settings
      ADD COLUMN mercado_pago_notification_url VARCHAR(500) NULL
      AFTER mercado_pago_checkout_url;
  END IF;

  UPDATE company_collecting_settings
  SET mercado_pago_environment = COALESCE(NULLIF(mercado_pago_environment, ''), 'test')
  WHERE id = 1;
END$$

DELIMITER ;

CALL migrate_configure_mercado_pago();

DROP PROCEDURE IF EXISTS migrate_configure_mercado_pago;
