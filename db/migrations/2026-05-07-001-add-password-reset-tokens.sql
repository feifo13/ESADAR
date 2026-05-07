CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash VARCHAR(128) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  requested_ip VARCHAR(64) NULL,
  requested_user_agent VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_password_reset_tokens_token_hash (token_hash),
  KEY idx_password_reset_tokens_user_id (user_id),
  KEY idx_password_reset_tokens_expires_at (expires_at),
  KEY idx_password_reset_tokens_used_at (used_at),
  CONSTRAINT fk_password_reset_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;
