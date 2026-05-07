-- Accepted offers flow: one accepted offer applies to one unit only.

ALTER TABLE cart_items
  ADD COLUMN accepted_offer_id BIGINT UNSIGNED NULL AFTER final_unit_price_snapshot,
  ADD COLUMN accepted_offer_price_snapshot DECIMAL(12,2) NULL AFTER accepted_offer_id,
  ADD COLUMN accepted_offer_quantity_snapshot INT UNSIGNED NOT NULL DEFAULT 0 AFTER accepted_offer_price_snapshot,
  ADD KEY idx_cart_items_accepted_offer_id (accepted_offer_id);

ALTER TABLE order_items
  ADD COLUMN accepted_offer_id BIGINT UNSIGNED NULL AFTER line_total_snapshot,
  ADD COLUMN accepted_offer_price_snapshot DECIMAL(12,2) NULL AFTER accepted_offer_id,
  ADD COLUMN accepted_offer_quantity_snapshot INT UNSIGNED NOT NULL DEFAULT 0 AFTER accepted_offer_price_snapshot,
  ADD KEY idx_order_items_accepted_offer_id (accepted_offer_id);

ALTER TABLE offers
  ADD COLUMN consumed_at DATETIME NULL AFTER cancelled_at,
  ADD COLUMN consumed_order_id BIGINT UNSIGNED NULL AFTER consumed_at,
  ADD KEY idx_offers_consumed_order_id (consumed_order_id),
  ADD CONSTRAINT fk_offers_consumed_order FOREIGN KEY (consumed_order_id) REFERENCES orders(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE cart_items
  ADD CONSTRAINT fk_cart_items_accepted_offer FOREIGN KEY (accepted_offer_id) REFERENCES offers(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE order_items
  ADD CONSTRAINT fk_order_items_accepted_offer FOREIGN KEY (accepted_offer_id) REFERENCES offers(id) ON DELETE SET NULL ON UPDATE CASCADE;
