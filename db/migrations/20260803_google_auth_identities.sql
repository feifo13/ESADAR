-- ESADAR - Google authentication identities
-- Idempotent schema addition. This migration does not link existing users automatically.

CREATE TABLE IF NOT EXISTS user_auth_identities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(30) NOT NULL,
  provider_subject VARCHAR(255) NOT NULL,
  provider_email VARCHAR(255) NOT NULL,
  email_verified TINYINT(1) NOT NULL DEFAULT 0,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_auth_identities_provider_subject (provider, provider_subject),
  UNIQUE KEY uq_user_auth_identities_user_provider (user_id, provider),
  KEY idx_user_auth_identities_provider_email (provider, provider_email),
  CONSTRAINT fk_user_auth_identities_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;
