-- =========================================================
-- ESADAR SANDBOX - VACIADO OPERATIVO + STOCK 100 + SEED MINIMO
-- =========================================================
-- Preserva:
--   - users, roles, user_roles
--   - customers vinculados a users y sus direcciones
--   - articles y article_images, sin tocar archivos fisicos del servidor
--   - catalogos maestros necesarios
-- Limpia:
--   - carritos, ordenes, pagos, webhooks, ofertas, leads, contactos,
--     wishlists, alertas, auditoria, logs de cliente e importaciones
-- Ajusta todas las prendas existentes a:
--   quantity_total = 100, quantity_available = 100,
--   quantity_reserved = 0, quantity_sold = 0, status = ACTIVE
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
DELETE FROM article_interest_alerts;
DELETE FROM lead_preferences;
DELETE FROM contact_messages;
DELETE FROM potential_customers;
DELETE FROM password_reset_tokens;
DELETE FROM article_import_batch_items;
DELETE FROM article_import_batches;
DELETE FROM article_stock_movements;

-- Se conservan perfiles CUSTOMER vinculados a usuarios reales.
DELETE ca
FROM customer_addresses ca
INNER JOIN customers c ON c.id = ca.customer_id
WHERE c.user_id IS NULL;

DELETE FROM customers
WHERE user_id IS NULL;

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
ALTER TABLE article_interest_alerts AUTO_INCREMENT = 1;
ALTER TABLE lead_preferences AUTO_INCREMENT = 1;
ALTER TABLE contact_messages AUTO_INCREMENT = 1;
ALTER TABLE potential_customers AUTO_INCREMENT = 1;
ALTER TABLE password_reset_tokens AUTO_INCREMENT = 1;
ALTER TABLE article_import_batch_items AUTO_INCREMENT = 1;
ALTER TABLE article_import_batches AUTO_INCREMENT = 1;
ALTER TABLE article_stock_movements AUTO_INCREMENT = 1;

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

-- =========================================================
-- Seed minimo no operativo: talles, categorias, marcas, envios, cobros y SEO
-- No crea ordenes, carritos, pagos, ofertas ni datos transaccionales.
-- =========================================================

INSERT INTO sizes (code, description, sort_order, is_active) VALUES
  ('XS', 'Extra Small', 10, 1),
  ('S', 'Small', 20, 1),
  ('M', 'Medium', 30, 1),
  ('L', 'Large', 40, 1),
  ('XL', 'Extra Large', 50, 1),
  ('XXL', 'Double Extra Large', 60, 1),
  ('UNICO', 'Talle unico', 70, 1),
  ('36', '36', 80, 1),
  ('38', '38', 90, 1),
  ('40', '40', 100, 1),
  ('42', '42', 110, 1)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active);

INSERT INTO categories (name, slug, description, sort_order, is_active, created_by, updated_by) VALUES
  ('Camperas', 'camperas', 'Camperas deportivas, rompevientros y jackets.', 10, 1, @admin_user_id, @admin_user_id),
  ('Buzos', 'buzos', 'Hoodies, crewnecks y buzos vintage.', 20, 1, @admin_user_id, @admin_user_id),
  ('Remeras', 'remeras', 'Tees, tops y remeras basicas o graficas.', 30, 1, @admin_user_id, @admin_user_id),
  ('Pantalones', 'pantalones', 'Jeans, joggers y pantalones urbanos.', 40, 1, @admin_user_id, @admin_user_id),
  ('Shorts', 'shorts', 'Shorts deportivos y casuales.', 50, 1, @admin_user_id, @admin_user_id),
  ('Accesorios', 'accesorios', 'Gorras, bolsos y accesorios seleccionados.', 60, 1, @admin_user_id, @admin_user_id)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active),
  updated_by = VALUES(updated_by);

INSERT INTO brands (name, slug, is_active, created_by, updated_by) VALUES
  ('Nike', 'nike', 1, @admin_user_id, @admin_user_id),
  ('Adidas', 'adidas', 1, @admin_user_id, @admin_user_id),
  ('Champion', 'champion', 1, @admin_user_id, @admin_user_id),
  ('Levis', 'levis', 1, @admin_user_id, @admin_user_id),
  ('Reebok', 'reebok', 1, @admin_user_id, @admin_user_id),
  ('Tommy Hilfiger', 'tommy-hilfiger', 1, @admin_user_id, @admin_user_id),
  ('New Balance', 'new-balance', 1, @admin_user_id, @admin_user_id),
  ('Russell Athletic', 'russell-athletic', 1, @admin_user_id, @admin_user_id),
  ('Puma', 'puma', 1, @admin_user_id, @admin_user_id)
ON DUPLICATE KEY UPDATE
  is_active = VALUES(is_active),
  updated_by = VALUES(updated_by);

INSERT INTO shipping_methods (description, base_cost, instructions, is_active, created_by, updated_by)
SELECT 'Retiro en punto acordado', 0.00, 'Coordinamos retiro por mensaje directo dentro de Montevideo.', 1, @admin_user_id, @admin_user_id
WHERE NOT EXISTS (SELECT 1 FROM shipping_methods WHERE description = 'Retiro en punto acordado');

INSERT INTO shipping_methods (description, base_cost, instructions, is_active, created_by, updated_by)
SELECT 'Cadeteria Montevideo', 180.00, 'Entregas en 24 a 48 horas dentro de Montevideo luego de aprobada la orden.', 1, @admin_user_id, @admin_user_id
WHERE NOT EXISTS (SELECT 1 FROM shipping_methods WHERE description = 'Cadeteria Montevideo');

INSERT INTO shipping_methods (description, base_cost, instructions, is_active, created_by, updated_by)
SELECT 'DAC interior', 260.00, 'Despacho al interior dentro de 24 horas habiles posteriores a la aprobacion.', 1, @admin_user_id, @admin_user_id
WHERE NOT EXISTS (SELECT 1 FROM shipping_methods WHERE description = 'DAC interior');

INSERT INTO company_collecting_settings (
  id,
  is_bank_transfer_enabled,
  bank_currency,
  bank_instructions,
  is_mercado_pago_enabled,
  mercado_pago_environment,
  mercado_pago_instructions,
  created_by,
  updated_by
)
VALUES (
  1,
  1,
  'UYU',
  'Luego de transferir, responde este correo con el comprobante para validar tu orden.',
  1,
  'test',
  'Paga con el boton o escanea el QR de Mercado Pago. Luego responde este correo con el comprobante para validar tu orden.',
  @admin_user_id,
  @admin_user_id
)
ON DUPLICATE KEY UPDATE
  updated_by = VALUES(updated_by);

INSERT INTO site_pages_seo (route, title, description, canonical_url, og_image, is_indexable) VALUES
  ('/', 'ESADAR | Ropa seleccionada', 'Sportswear, vintage y prendas modernas elegidas una por una. Stock limitado y piezas unicas.', NULL, NULL, 1),
  ('/about', 'Sobre ESADAR | Curaduria', 'Conoce la seleccion de ESADAR: prendas unicas, sportswear, vintage y ropa moderna elegida con criterio.', NULL, NULL, 1),
  ('/contact', 'Contacto | ESADAR', 'Consultanos por una prenda, talles, ingresos nuevos o formas de entrega.', NULL, NULL, 1),
  ('/guia-de-compra', 'Guia de compra | ESADAR', 'Como comprar en ESADAR, medios de pago, envios y aprobacion de ordenes.', NULL, NULL, 1),
  ('/terminos-y-condiciones', 'Terminos y condiciones | ESADAR', 'Condiciones de compra, pagos, reservas, cambios y uso del sitio ESADAR.', NULL, NULL, 1)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  description = VALUES(description),
  canonical_url = VALUES(canonical_url),
  og_image = VALUES(og_image),
  is_indexable = VALUES(is_indexable);

UPDATE articles
SET quantity_total = 100,
    quantity_available = 100,
    quantity_reserved = 0,
    quantity_sold = 0,
    status = 'ACTIVE',
    updated_by = @admin_user_id;
