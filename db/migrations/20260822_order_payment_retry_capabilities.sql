CREATE TABLE IF NOT EXISTS order_payment_retry_capabilities (
  order_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (order_id),
  KEY idx_order_payment_retry_capabilities_expires_at (expires_at),

  CONSTRAINT fk_order_payment_retry_capabilities_order
    FOREIGN KEY (order_id)
    REFERENCES orders(id)
    ON DELETE CASCADE
);
