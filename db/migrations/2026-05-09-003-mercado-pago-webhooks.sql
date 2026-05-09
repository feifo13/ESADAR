-- Mercado Pago webhooks: firma secreta e historial de notificaciones.
-- Compatible con MySQL sin ADD COLUMN IF NOT EXISTS.

DROP PROCEDURE IF EXISTS migrate_mercado_pago_webhooks;

DELIMITER $$

CREATE PROCEDURE migrate_mercado_pago_webhooks()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'company_collecting_settings'
      AND COLUMN_NAME = 'mercado_pago_webhook_secret'
  ) THEN
    ALTER TABLE company_collecting_settings
      ADD COLUMN mercado_pago_webhook_secret VARCHAR(500) NULL
      AFTER mercado_pago_notification_url;
  END IF;
END$$

DELIMITER ;

CALL migrate_mercado_pago_webhooks();

DROP PROCEDURE IF EXISTS migrate_mercado_pago_webhooks;

CREATE TABLE IF NOT EXISTS mercado_pago_webhook_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider_event_id VARCHAR(120) NULL,
  request_id VARCHAR(120) NULL,
  event_type VARCHAR(80) NULL,
  action VARCHAR(120) NULL,
  payment_id VARCHAR(120) NULL,
  order_id BIGINT UNSIGNED NULL,
  processing_status ENUM('RECEIVED','PROCESSED','IGNORED','FAILED') NOT NULL DEFAULT 'RECEIVED',
  status_message VARCHAR(500) NULL,
  signature_validated TINYINT(1) NOT NULL DEFAULT 0,
  payload_json JSON NULL,
  payment_json JSON NULL,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  attempt_count INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mp_webhook_provider_event_id (provider_event_id),
  KEY idx_mp_webhook_payment_id (payment_id),
  KEY idx_mp_webhook_order_id (order_id),
  KEY idx_mp_webhook_status (processing_status),
  KEY idx_mp_webhook_received_at (received_at),
  CONSTRAINT fk_mp_webhook_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;
