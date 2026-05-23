-- =========================================================
-- ESADAR SANDBOX - VACIADO OPERATIVO + STOCK 100 + SEED MINIMO
-- =========================================================
-- Preserva:
--   - users, roles, user_roles
--   - customers vinculados a users y sus direcciones
--   - articles y article_images, sin tocar archivos fisicos del servidor
--   - catálogos maestros necesarios
-- Limpia:
--   - carritos, órdenes, pagos, webhooks, ofertas, leads, contactos,
--     wishlists, alertas, auditoria, logs de cliente e importaciones
-- Ajusta todas las prendas existentes a:
--   article_inventory total/disponible = 100,
--   reservado/vendido/perdido = 0, articles.status = ACTIVE
-- =========================================================

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET collation_connection = 'utf8mb4_unicode_ci';
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
ALTER TABLE public_page_visits AUTO_INCREMENT = 1;
ALTER TABLE article_interest_alerts AUTO_INCREMENT = 1;
ALTER TABLE lead_preferences AUTO_INCREMENT = 1;
ALTER TABLE contact_messages AUTO_INCREMENT = 1;
ALTER TABLE potential_customers AUTO_INCREMENT = 1;
ALTER TABLE password_reset_tokens AUTO_INCREMENT = 1;
ALTER TABLE article_import_batch_items AUTO_INCREMENT = 1;
ALTER TABLE article_import_batches AUTO_INCREMENT = 1;
ALTER TABLE article_inventory_movements AUTO_INCREMENT = 1;

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

SET @esadar_super_admin_email := _utf8mb4'fefio1313@gmail.com' COLLATE utf8mb4_unicode_ci;
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

SET @admin_user_id := (
  SELECT id
  FROM users
  WHERE email = CONVERT(@esadar_super_admin_email USING utf8mb4) COLLATE utf8mb4_unicode_ci
  LIMIT 1
);
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
-- Seed mínimo no operativo: talles, categorías, marcas, envíos, cobros y SEO
-- No crea órdenes, carritos, pagos, ofertas ni datos transaccionales.
-- =========================================================

INSERT INTO sizes (code, description, sort_order, is_active) VALUES
  ('XS', 'Extra Small', 10, 1),
  ('S', 'Small', 20, 1),
  ('M', 'Medium', 30, 1),
  ('L', 'Large', 40, 1),
  ('XL', 'Extra Large', 50, 1),
  ('XXL', 'Double Extra Large', 60, 1),
  ('UNICO', 'Talle único', 70, 1),
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
  ('Remeras', 'remeras', 'Tees, tops y remeras básicas o gráficas.', 30, 1, @admin_user_id, @admin_user_id),
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
SELECT 'Cadetería Montevideo', 180.00, 'Entregas en 24 a 48 horas dentro de Montevideo luego de aprobada la orden.', 1, @admin_user_id, @admin_user_id
WHERE NOT EXISTS (SELECT 1 FROM shipping_methods WHERE description = 'Cadetería Montevideo');

INSERT INTO shipping_methods (description, base_cost, instructions, is_active, created_by, updated_by)
SELECT 'DAC interior', 260.00, 'Despacho al interior dentro de 24 horas hábiles posteriores a la aprobación.', 1, @admin_user_id, @admin_user_id
WHERE NOT EXISTS (SELECT 1 FROM shipping_methods WHERE description = 'DAC interior');


INSERT INTO shipping_methods (
  description,
  base_cost,
  pricing_type,
  instructions,
  official_rates_label,
  official_rates_file_path,
  is_active,
  created_by,
  updated_by
)
SELECT
  'Ahiva / Correo Uruguayo',
  195.00,
  'WEIGHT_RANGES',
  'Tarifa nacional calculada por peso aproximado del paquete según tabla Ahiva / Correo Uruguayo.',
  'Ver tarifas oficiales',
  '/docs/tarifas-ahiva-correo.pdf',
  1,
  @admin_user_id,
  @admin_user_id
WHERE NOT EXISTS (SELECT 1 FROM shipping_methods WHERE description = 'Ahiva / Correo Uruguayo');

UPDATE shipping_methods
SET
  pricing_type = 'WEIGHT_RANGES',
  official_rates_label = COALESCE(NULLIF(TRIM(official_rates_label), ''), 'Ver tarifas oficiales'),
  official_rates_file_path = COALESCE(NULLIF(TRIM(official_rates_file_path), ''), '/docs/tarifas-ahiva-correo.pdf'),
  updated_by = @admin_user_id
WHERE description = 'Ahiva / Correo Uruguayo';

INSERT INTO shipping_method_weight_rates (shipping_method_id, min_weight_kg, max_weight_kg, price, label, sort_order, is_active, created_by, updated_by)
SELECT sm.id, rates.min_weight_kg, rates.max_weight_kg, rates.price, rates.label, rates.sort_order, 1, @admin_user_id, @admin_user_id
FROM shipping_methods sm
JOIN (
  SELECT 0.000 AS min_weight_kg, 2.000 AS max_weight_kg, 195.00 AS price, 'Hasta 2 kg' AS label, 1 AS sort_order
  UNION ALL SELECT 2.000, 5.000, 220.00, 'De 2 a 5 kg', 2
  UNION ALL SELECT 5.000, 10.000, 275.00, 'De 5 a 10 kg', 3
  UNION ALL SELECT 10.000, 15.000, 325.00, 'De 10 a 15 kg', 4
  UNION ALL SELECT 15.000, 20.000, 405.00, 'De 15 a 20 kg', 5
  UNION ALL SELECT 20.000, 25.000, 465.00, 'De 20 a 25 kg', 6
  UNION ALL SELECT 25.000, 30.000, 550.00, 'De 25 a 30 kg', 7
) rates
WHERE sm.description = 'Ahiva / Correo Uruguayo'
  AND NOT EXISTS (
    SELECT 1
    FROM shipping_method_weight_rates existing
    WHERE existing.shipping_method_id = sm.id
  );

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

INSERT INTO site_ticker_settings (
  id,
  ticker_enabled,
  ticker_text,
  ticker_target_url,
  ticker_target_section,
  ticker_background_color,
  ticker_sticky,
  updated_by
)
VALUES (
  1,
  1,
  'ACEPTAMOS OFERTAS EN ARTÍCULOS SELECCIONADOS',
  '/articles',
  NULL,
  '#ec672b',
  0,
  @admin_user_id
)
ON DUPLICATE KEY UPDATE
  updated_by = VALUES(updated_by);

INSERT INTO site_pages_seo (route, title, description, canonical_url, og_image, is_indexable) VALUES
  ('/', 'ESADAR | Ropa seleccionada', 'Sportswear, vintage y prendas modernas elegidas una por una. Stock limitado y piezas únicas.', NULL, NULL, 1),
  ('/articles', 'Catálogo | ESADAR', 'Explorá el catálogo de ESADAR: prendas seleccionadas, sportswear, vintage y ropa moderna con stock limitado.', NULL, NULL, 1),
  ('/about', 'Sobre ESADAR | Selección', 'Conocé la selección de ESADAR: prendas únicas, sportswear, vintage y ropa moderna elegida con criterio.', NULL, NULL, 1),
  ('/contact', 'Contacto | ESADAR', 'Consultanos por una prenda, talles, ingresos nuevos o formas de entrega.', NULL, NULL, 1),
  ('/guia-de-compra', 'Guía de compra | ESADAR', 'Cómo comprar en ESADAR, medios de pago, envíos y aprobación de órdenes.', NULL, NULL, 1),
  ('/terminos-y-condiciones', 'Términos y condiciones | ESADAR', 'Condiciones de compra, pagos, reservas, cambios y uso del sitio ESADAR.', NULL, NULL, 1)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  description = VALUES(description),
  canonical_url = VALUES(canonical_url),
  og_image = VALUES(og_image),
  is_indexable = VALUES(is_indexable);

UPDATE articles
SET status = 'ACTIVE',
    updated_by = @admin_user_id;

INSERT INTO article_inventory (
  article_id,
  quantity_total,
  quantity_available,
  quantity_reserved,
  quantity_sold,
  quantity_lost,
  updated_by
)
SELECT
  id,
  100,
  100,
  0,
  0,
  0,
  @admin_user_id
FROM articles
ON DUPLICATE KEY UPDATE
  quantity_total = VALUES(quantity_total),
  quantity_available = VALUES(quantity_available),
  quantity_reserved = VALUES(quantity_reserved),
  quantity_sold = VALUES(quantity_sold),
  quantity_lost = VALUES(quantity_lost),
  updated_by = VALUES(updated_by);

INSERT INTO article_inventory_movements (
  article_id,
  movement_type,
  available_delta,
  reserved_delta,
  sold_delta,
  lost_delta,
  quantity_available_after,
  quantity_reserved_after,
  quantity_sold_after,
  quantity_lost_after,
  reason,
  created_by
)
SELECT
  article_id,
  'MANUAL_ADJUSTMENT',
  quantity_available,
  0,
  0,
  0,
  quantity_available,
  quantity_reserved,
  quantity_sold,
  quantity_lost,
  'Reset operativo stock 100',
  @admin_user_id
FROM article_inventory;
