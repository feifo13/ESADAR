-- Mark accepted offers as used after checkout instead of leaving the DB status ambiguous.
-- This keeps the internal status enum aligned with the UI labels while consumed_at and
-- consumed_order_id remain the source of the order linkage.

ALTER TABLE offers
  MODIFY status ENUM('PENDING','ACCEPTED','REJECTED','EXPIRED','CANCELLED','USED') NOT NULL DEFAULT 'PENDING';

ALTER TABLE offer_status_history
  MODIFY from_status ENUM('PENDING','ACCEPTED','REJECTED','EXPIRED','CANCELLED','USED') NULL,
  MODIFY to_status ENUM('PENDING','ACCEPTED','REJECTED','EXPIRED','CANCELLED','USED') NOT NULL;

UPDATE offers
SET status = 'USED'
WHERE status = 'ACCEPTED'
  AND consumed_at IS NOT NULL;
