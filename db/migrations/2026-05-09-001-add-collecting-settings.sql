CREATE TABLE IF NOT EXISTS company_collecting_settings (
  id TINYINT UNSIGNED NOT NULL DEFAULT 1,
  is_bank_transfer_enabled TINYINT(1) NOT NULL DEFAULT 1,
  bank_account_holder VARCHAR(150) NULL,
  bank_name VARCHAR(150) NULL,
  bank_account_type VARCHAR(80) NULL,
  bank_account_number VARCHAR(120) NULL,
  bank_branch VARCHAR(80) NULL,
  bank_currency VARCHAR(20) NULL DEFAULT 'UYU',
  bank_alias VARCHAR(120) NULL,
  bank_document VARCHAR(80) NULL,
  bank_instructions TEXT NULL,
  is_mercado_pago_enabled TINYINT(1) NOT NULL DEFAULT 1,
  mercado_pago_environment ENUM('test','production') NOT NULL DEFAULT 'test',
  mercado_pago_public_key VARCHAR(255) NULL,
  mercado_pago_access_token VARCHAR(500) NULL,
  mercado_pago_user_id VARCHAR(120) NULL,
  mercado_pago_checkout_url VARCHAR(500) NULL,
  mercado_pago_notification_url VARCHAR(500) NULL,
  mercado_pago_webhook_secret VARCHAR(500) NULL,
  mercado_pago_preference_note TEXT NULL,
  mercado_pago_instructions TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  CONSTRAINT chk_company_collecting_settings_singleton CHECK (id = 1),
  KEY idx_company_collecting_created_by (created_by),
  KEY idx_company_collecting_updated_by (updated_by),
  CONSTRAINT fk_company_collecting_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_company_collecting_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

INSERT INTO company_collecting_settings (id, bank_currency, mercado_pago_environment)
VALUES (1, 'UYU', 'test')
ON DUPLICATE KEY UPDATE id = id;
