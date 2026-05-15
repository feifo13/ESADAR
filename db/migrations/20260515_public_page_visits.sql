CREATE TABLE IF NOT EXISTS public_page_visits (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  page_type ENUM('HOME','CATALOG','ARTICLE_DETAIL','PURCHASE_GUIDE','TERMS','CONTACT') NOT NULL,
  route VARCHAR(255) NOT NULL,
  article_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_public_page_visits_page_created (page_type, created_at),
  KEY idx_public_page_visits_route_created (route, created_at),
  KEY idx_public_page_visits_article_created (article_id, created_at),
  CONSTRAINT fk_public_page_visits_article
    FOREIGN KEY (article_id) REFERENCES articles(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
