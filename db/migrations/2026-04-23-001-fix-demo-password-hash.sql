USE secondhand_store_v1;

SET @expected_demo_hash := '$2b$10$7fkvkYZGeCW7mGrswngQHeW.eQEedJm.AXQgWSBvy4jR/AcnckCci';
SET @legacy_demo_hash := '$2a$10$TvhkMBuBfkdy0dlbhgp6YuH9atDgxkSUTFy9nYkBIrpfiDK5HH8a6';

UPDATE users
SET password_hash = @expected_demo_hash
WHERE email IN (
  'admin@miamicloset.test',
  'operaciones@miamicloset.test',
  'lucia.cliente@test.com'
)
  AND (password_hash IS NULL OR password_hash = @legacy_demo_hash);

UPDATE users
SET last_name = 'ESADAR'
WHERE email = 'admin@miamicloset.test' AND last_name = 'Miami Closet';

UPDATE audit_log
SET actor_label = 'Admin ESADAR'
WHERE actor_label = 'Admin Miami Closet';
