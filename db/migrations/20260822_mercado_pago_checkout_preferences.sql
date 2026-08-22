-- ESADAR
-- Canonical Mercado Pago Checkout Pro preference state.
--
-- One canonical preference lifecycle per local order/environment.
-- This table is operational state.
-- mercado_pago_preference_events remains audit/history.

CREATE TABLE IF NOT EXISTS mercado_pago_checkout_preferences (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  order_number VARCHAR(50) NOT NULL,
  environment ENUM('test','production') NOT NULL DEFAULT 'test',
  status ENUM('CREATING','READY','FAILED') NOT NULL DEFAULT 'CREATING',
  preference_id VARCHAR(120) NULL,
  checkout_url VARCHAR(500) NULL,
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  last_failure_status INT NULL,
  last_failure_reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mp_checkout_order_environment (
    order_id,
    environment
  ),
  UNIQUE KEY uq_mp_checkout_preference_id (
    preference_id
  ),
  KEY idx_mp_checkout_order_number (
    order_number
  ),
  KEY idx_mp_checkout_status (
    status
  ),
  CONSTRAINT fk_mp_checkout_order
    FOREIGN KEY (order_id)
    REFERENCES orders(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB;
