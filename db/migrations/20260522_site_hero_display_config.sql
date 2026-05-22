ALTER TABLE site_hero
  ADD COLUMN hero_height_mode ENUM('HALF_SCREEN','FULL_SCREEN','CUSTOM') NOT NULL DEFAULT 'HALF_SCREEN' AFTER cta_url,
  ADD COLUMN custom_height_vh INT UNSIGNED NULL AFTER hero_height_mode,
  ADD COLUMN hero_display_mode ENUM('SINGLE_IMAGE','CAROUSEL') NOT NULL DEFAULT 'SINGLE_IMAGE' AFTER custom_height_vh;

CREATE TABLE IF NOT EXISTS site_hero_images (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  hero_id BIGINT UNSIGNED NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  image_alt VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_site_hero_images_hero_sort (hero_id, is_active, sort_order, id),
  CONSTRAINT fk_site_hero_images_hero FOREIGN KEY (hero_id) REFERENCES site_hero(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO site_hero_images (
  hero_id,
  image_url,
  image_alt,
  sort_order,
  is_active
)
SELECT
  sh.id,
  sh.image_url,
  sh.image_alt,
  0,
  1
FROM site_hero sh
WHERE sh.image_url IS NOT NULL
  AND sh.image_url <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM site_hero_images shi
    WHERE shi.hero_id = sh.id
  );
