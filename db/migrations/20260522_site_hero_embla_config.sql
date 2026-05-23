ALTER TABLE site_hero
  ADD COLUMN carousel_speed_seconds INT UNSIGNED NOT NULL DEFAULT 6 AFTER hero_display_mode,
  ADD COLUMN carousel_loop TINYINT(1) NOT NULL DEFAULT 1 AFTER carousel_speed_seconds,
  ADD COLUMN carousel_drag_free TINYINT(1) NOT NULL DEFAULT 0 AFTER carousel_loop,
  ADD COLUMN carousel_stop_on_interaction TINYINT(1) NOT NULL DEFAULT 0 AFTER carousel_drag_free,
  ADD COLUMN carousel_stop_on_mouse_enter TINYINT(1) NOT NULL DEFAULT 1 AFTER carousel_stop_on_interaction;
