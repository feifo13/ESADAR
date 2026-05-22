-- =========================================================
-- ESADAR SANDBOX - VACIADO OPERATIVO DEJANDO SOLO USUARIOS
-- =========================================================
-- Preserva solamente:
--   - users
--   - roles
--   - user_roles
-- Limpia todo el resto de datos de negocio/catalogo/configuracion.
-- Asegura que exista CUSTOMER y que usuarios sin rol administrativo/operativo
-- queden como CUSTOMER.
-- =========================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

SET @OLD_FOREIGN_KEY_CHECKS := @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

START TRANSACTION;

DELETE FROM audit_log;
DELETE FROM client_error_logs;
DELETE FROM mercado_pago_preference_events;
DELETE FROM mercado_pago_webhook_events;
DELETE FROM payments;
DELETE FROM offer_status_history;
DELETE FROM offers;
DELETE FROM order_status_history;
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM cart_items;
DELETE FROM carts;
DELETE FROM wishlist_items;
DELETE FROM wishlists;
DELETE FROM article_events;
DELETE FROM public_page_visits;
DELETE FROM article_interest_alerts;
DELETE FROM lead_preferences;
DELETE FROM contact_messages;
DELETE FROM potential_customers;
DELETE FROM password_reset_tokens;
DELETE FROM article_import_batch_items;
DELETE FROM article_import_batches;
DELETE FROM article_inventory_movements;
DELETE FROM article_inventory;
DELETE FROM article_images;
DELETE FROM articles;
DELETE FROM customer_addresses;
DELETE FROM customers;
DELETE FROM company_collecting_settings;
DELETE FROM shipping_method_weight_rates;
DELETE FROM shipping_methods;
DELETE FROM site_hero;
DELETE FROM site_pages_seo;
DELETE FROM categories;
DELETE FROM brands;
DELETE FROM sizes;

COMMIT;

ALTER TABLE audit_log AUTO_INCREMENT = 1;
ALTER TABLE client_error_logs AUTO_INCREMENT = 1;
ALTER TABLE mercado_pago_preference_events AUTO_INCREMENT = 1;
ALTER TABLE mercado_pago_webhook_events AUTO_INCREMENT = 1;
ALTER TABLE payments AUTO_INCREMENT = 1;
ALTER TABLE offer_status_history AUTO_INCREMENT = 1;
ALTER TABLE offers AUTO_INCREMENT = 1;
ALTER TABLE order_status_history AUTO_INCREMENT = 1;
ALTER TABLE order_items AUTO_INCREMENT = 1;
ALTER TABLE orders AUTO_INCREMENT = 1;
ALTER TABLE cart_items AUTO_INCREMENT = 1;
ALTER TABLE carts AUTO_INCREMENT = 1;
ALTER TABLE wishlist_items AUTO_INCREMENT = 1;
ALTER TABLE wishlists AUTO_INCREMENT = 1;
ALTER TABLE article_events AUTO_INCREMENT = 1;
ALTER TABLE public_page_visits AUTO_INCREMENT = 1;
ALTER TABLE article_interest_alerts AUTO_INCREMENT = 1;
ALTER TABLE lead_preferences AUTO_INCREMENT = 1;
ALTER TABLE contact_messages AUTO_INCREMENT = 1;
ALTER TABLE potential_customers AUTO_INCREMENT = 1;
ALTER TABLE password_reset_tokens AUTO_INCREMENT = 1;
ALTER TABLE article_import_batch_items AUTO_INCREMENT = 1;
ALTER TABLE article_import_batches AUTO_INCREMENT = 1;
ALTER TABLE article_inventory_movements AUTO_INCREMENT = 1;
ALTER TABLE article_images AUTO_INCREMENT = 1;
ALTER TABLE articles AUTO_INCREMENT = 1;
ALTER TABLE customer_addresses AUTO_INCREMENT = 1;
ALTER TABLE customers AUTO_INCREMENT = 1;
ALTER TABLE shipping_method_weight_rates AUTO_INCREMENT = 1;
ALTER TABLE shipping_methods AUTO_INCREMENT = 1;
ALTER TABLE site_hero AUTO_INCREMENT = 1;
ALTER TABLE site_pages_seo AUTO_INCREMENT = 1;
ALTER TABLE categories AUTO_INCREMENT = 1;
ALTER TABLE brands AUTO_INCREMENT = 1;
ALTER TABLE sizes AUTO_INCREMENT = 1;

SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;

-- =========================================================
-- Seed minimo obligatorio: roles + super admin
-- =========================================================

INSERT INTO roles (code, name, is_active) VALUES
  ('SUPER_ADMIN', 'Super Admin', 1),
  ('ADMIN', 'Admin', 1),
  ('OPERATOR', 'Operator', 1),
  ('CUSTOMER', 'Customer', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  is_active = 1;

SET @esadar_super_admin_email := 'fefio1313@gmail.com';
SET @esadar_super_admin_password_hash := '$2b$10$Z7dhGDzCSsn0bU5TrJWCc.mkmdYN0Cbn88l6t5kjuAh/eaGEK2xHK';

INSERT INTO users (
  first_name,
  last_name,
  birth_date,
  email,
  password_hash,
  address,
  phone,
  instagram,
  is_active,
  created_by,
  updated_by
)
VALUES (
  'Federico',
  'Ramos',
  NULL,
  @esadar_super_admin_email,
  @esadar_super_admin_password_hash,
  NULL,
  NULL,
  NULL,
  1,
  NULL,
  NULL
)
ON DUPLICATE KEY UPDATE
  first_name = VALUES(first_name),
  last_name = VALUES(last_name),
  password_hash = VALUES(password_hash),
  is_active = 1,
  updated_by = NULL;

SET @admin_user_id := (SELECT id FROM users WHERE email = @esadar_super_admin_email LIMIT 1);
SET @super_admin_role_id := (SELECT id FROM roles WHERE code = 'SUPER_ADMIN' LIMIT 1);
SET @admin_role_id := (SELECT id FROM roles WHERE code = 'ADMIN' LIMIT 1);
SET @customer_role_id := (SELECT id FROM roles WHERE code = 'CUSTOMER' LIMIT 1);

UPDATE users
SET created_by = COALESCE(created_by, @admin_user_id),
    updated_by = @admin_user_id
WHERE id = @admin_user_id;

INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT @admin_user_id, @super_admin_role_id, @admin_user_id
WHERE @admin_user_id IS NOT NULL
  AND @super_admin_role_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = @admin_user_id AND role_id = @super_admin_role_id
  );

INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT @admin_user_id, @admin_role_id, @admin_user_id
WHERE @admin_user_id IS NOT NULL
  AND @admin_role_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = @admin_user_id AND role_id = @admin_role_id
  );

-- Reparacion defensiva: cualquier usuario sin rol administrativo/operativo queda como CUSTOMER.
-- Esto cubre cuentas creadas desde frontend antes de que existiera el rol CUSTOMER.
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT u.id, @customer_role_id, @admin_user_id
FROM users u
WHERE @customer_role_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM user_roles ur
    WHERE ur.user_id = u.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM user_roles ur_admin
    INNER JOIN roles r_admin ON r_admin.id = ur_admin.role_id
    WHERE ur_admin.user_id = u.id
      AND r_admin.code IN ('SUPER_ADMIN', 'ADMIN', 'OPERATOR')
  );
