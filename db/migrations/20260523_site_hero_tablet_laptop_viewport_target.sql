-- Add an explicit tablet/laptop-small image target for the public hero.
-- Keeps existing DESKTOP_TABLET and MOBILE values intact.

ALTER TABLE site_hero_images
  MODIFY COLUMN viewport_target ENUM('DESKTOP_TABLET','TABLET_LAPTOP','MOBILE') NOT NULL DEFAULT 'DESKTOP_TABLET';
