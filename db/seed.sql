-- =========================================================
-- Second-hand curated store - MySQL seed v1
-- Demo seed for local/dev environments
-- Assumes schema file secondhand_store_v1.sql has already run
-- =========================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

USE secondhand_store_v1;

START TRANSACTION;

-- =========================================================
-- 1) Base users and roles
-- Demo password for seeded users: 123456
-- Hash below is a bcrypt-style demo hash expected to match 123456
-- Replace it if your auth stack requires a different algorithm/version
-- =========================================================

SET @demo_password_hash := '$2a$10$TvhkMBuBfkdy0dlbhgp6YuH9atDgxkSUTFy9nYkBIrpfiDK5HH8a6';

INSERT INTO users (
  first_name, last_name, birth_date, email, password_hash, address, phone, instagram,
  is_active, created_by, updated_by
)
SELECT
  'Admin', 'Miami Closet', '1990-01-15', 'admin@miamicloset.test', @demo_password_hash,
  'Montevideo, Uruguay', '099100001', '@miamicloset_admin',
  1, NULL, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE email = 'admin@miamicloset.test'
);

SET @admin_user_id := (SELECT id FROM users WHERE email = 'admin@miamicloset.test' LIMIT 1);

UPDATE users
SET created_by = COALESCE(created_by, @admin_user_id),
    updated_by = COALESCE(updated_by, @admin_user_id)
WHERE id = @admin_user_id;

INSERT INTO users (
  first_name, last_name, birth_date, email, password_hash, address, phone, instagram,
  is_active, created_by, updated_by
)
SELECT
  'Sofia', 'Operaciones', '1994-05-20', 'operaciones@miamicloset.test', @demo_password_hash,
  'Cordón, Montevideo', '099100002', '@miamicloset_ops',
  1, @admin_user_id, @admin_user_id
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE email = 'operaciones@miamicloset.test'
);

INSERT INTO users (
  first_name, last_name, birth_date, email, password_hash, address, phone, instagram,
  is_active, created_by, updated_by
)
SELECT
  'Lucia', 'Cliente', '2001-08-10', 'lucia.cliente@test.com', @demo_password_hash,
  'Parque Rodó, Montevideo', '099100003', '@lucia_outfits',
  1, @admin_user_id, @admin_user_id
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE email = 'lucia.cliente@test.com'
);

SET @operator_user_id := (SELECT id FROM users WHERE email = 'operaciones@miamicloset.test' LIMIT 1);
SET @customer_user_id := (SELECT id FROM users WHERE email = 'lucia.cliente@test.com' LIMIT 1);

INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT @admin_user_id, r.id, @admin_user_id
FROM roles r
WHERE r.code = 'SUPER_ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = @admin_user_id AND ur.role_id = r.id
  );

INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT @operator_user_id, r.id, @admin_user_id
FROM roles r
WHERE r.code = 'OPERATOR'
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = @operator_user_id AND ur.role_id = r.id
  );

INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT @customer_user_id, r.id, @admin_user_id
FROM roles r
WHERE r.code = 'CUSTOMER'
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = @customer_user_id AND ur.role_id = r.id
  );

-- =========================================================
-- 2) Customers and prospects
-- =========================================================

INSERT INTO customers (
  user_id, first_name, last_name, birth_date, email, address, phone, instagram,
  source, notes_internal, is_active, created_by, updated_by
)
SELECT
  @customer_user_id, 'Lucia', 'Cliente', '2001-08-10', 'lucia.cliente@test.com',
  'Parque Rodó, Montevideo', '099100003', '@lucia_outfits',
  'REGISTERED', 'Cliente demo vinculada a usuario.', 1, @admin_user_id, @admin_user_id
WHERE NOT EXISTS (
  SELECT 1 FROM customers WHERE email = 'lucia.cliente@test.com'
);

INSERT INTO customers (
  user_id, first_name, last_name, birth_date, email, address, phone, instagram,
  source, notes_internal, is_active, created_by, updated_by
)
SELECT
  NULL, 'Martin', 'Invitado', '1996-11-02', 'martin.invitado@test.com',
  'Centro, Montevideo', '099100004', '@martin_secondhand',
  'GUEST_CHECKOUT', 'Cliente invitado demo.', 1, @admin_user_id, @admin_user_id
WHERE NOT EXISTS (
  SELECT 1 FROM customers WHERE email = 'martin.invitado@test.com'
);

SET @customer_lucia_id := (SELECT id FROM customers WHERE email = 'lucia.cliente@test.com' LIMIT 1);
SET @customer_martin_id := (SELECT id FROM customers WHERE email = 'martin.invitado@test.com' LIMIT 1);

INSERT INTO customer_addresses (
  customer_id, label, address_line, city, state, country, postal_code, is_default
)
SELECT
  @customer_lucia_id, 'Casa', 'Bulevar España 2450', 'Montevideo', 'Montevideo', 'Uruguay', '11200', 1
WHERE NOT EXISTS (
  SELECT 1 FROM customer_addresses
  WHERE customer_id = @customer_lucia_id AND address_line = 'Bulevar España 2450'
);

INSERT INTO customer_addresses (
  customer_id, label, address_line, city, state, country, postal_code, is_default
)
SELECT
  @customer_martin_id, 'Trabajo', '18 de Julio 1620', 'Montevideo', 'Montevideo', 'Uruguay', '11100', 1
WHERE NOT EXISTS (
  SELECT 1 FROM customer_addresses
  WHERE customer_id = @customer_martin_id AND address_line = '18 de Julio 1620'
);

INSERT INTO potential_customers (
  first_name, last_name, birth_date, email, address, phone, instagram, source, linked_customer_id
)
SELECT
  'Camila', 'Oferta', '2004-03-12', 'camila.oferta@test.com', 'Malvín, Montevideo',
  '099100005', '@camila_preloved', 'CHECKOUT', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM potential_customers WHERE email = 'camila.oferta@test.com'
);

SET @potential_camila_id := (SELECT id FROM potential_customers WHERE email = 'camila.oferta@test.com' LIMIT 1);

-- =========================================================
-- 3) Master data: categories, brands, shipping methods
-- =========================================================

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
SELECT 'Cadeteria Montevideo', 180.00, 'Entregas en 24 a 48 horas dentro de Montevideo luego de aprobada la orden.', 1, @admin_user_id, @admin_user_id
WHERE NOT EXISTS (SELECT 1 FROM shipping_methods WHERE description = 'Cadeteria Montevideo');

INSERT INTO shipping_methods (description, base_cost, instructions, is_active, created_by, updated_by)
SELECT 'DAC interior', 260.00, 'Despacho al interior dentro de 24 horas hábiles posteriores a la aprobación.', 1, @admin_user_id, @admin_user_id
WHERE NOT EXISTS (SELECT 1 FROM shipping_methods WHERE description = 'DAC interior');

SET @cat_camperas := (SELECT id FROM categories WHERE slug = 'camperas' LIMIT 1);
SET @cat_buzos := (SELECT id FROM categories WHERE slug = 'buzos' LIMIT 1);
SET @cat_remeras := (SELECT id FROM categories WHERE slug = 'remeras' LIMIT 1);
SET @cat_pantalones := (SELECT id FROM categories WHERE slug = 'pantalones' LIMIT 1);
SET @cat_shorts := (SELECT id FROM categories WHERE slug = 'shorts' LIMIT 1);
SET @cat_accesorios := (SELECT id FROM categories WHERE slug = 'accesorios' LIMIT 1);

SET @brand_nike := (SELECT id FROM brands WHERE slug = 'nike' LIMIT 1);
SET @brand_adidas := (SELECT id FROM brands WHERE slug = 'adidas' LIMIT 1);
SET @brand_champion := (SELECT id FROM brands WHERE slug = 'champion' LIMIT 1);
SET @brand_levis := (SELECT id FROM brands WHERE slug = 'levis' LIMIT 1);
SET @brand_reebok := (SELECT id FROM brands WHERE slug = 'reebok' LIMIT 1);
SET @brand_tommy := (SELECT id FROM brands WHERE slug = 'tommy-hilfiger' LIMIT 1);
SET @brand_nb := (SELECT id FROM brands WHERE slug = 'new-balance' LIMIT 1);
SET @brand_russell := (SELECT id FROM brands WHERE slug = 'russell-athletic' LIMIT 1);
SET @brand_puma := (SELECT id FROM brands WHERE slug = 'puma' LIMIT 1);

SET @size_s := (SELECT id FROM sizes WHERE code = 'S' LIMIT 1);
SET @size_m := (SELECT id FROM sizes WHERE code = 'M' LIMIT 1);
SET @size_l := (SELECT id FROM sizes WHERE code = 'L' LIMIT 1);
SET @size_xl := (SELECT id FROM sizes WHERE code = 'XL' LIMIT 1);
SET @size_38 := (SELECT id FROM sizes WHERE code = '38' LIMIT 1);
SET @size_40 := (SELECT id FROM sizes WHERE code = '40' LIMIT 1);
SET @ship_pickup := (SELECT id FROM shipping_methods WHERE description = 'Retiro en punto acordado' LIMIT 1);
SET @ship_mvd := (SELECT id FROM shipping_methods WHERE description = 'Cadeteria Montevideo' LIMIT 1);
SET @ship_dac := (SELECT id FROM shipping_methods WHERE description = 'DAC interior' LIMIT 1);

-- =========================================================
-- 4) Articles
-- =========================================================

INSERT INTO articles (
  internal_code, slug, title, category_id, brand_id, size_id, size_text, measurements_text, description,
  purchase_price_item, purchase_price_shipping, purchase_price_courier,
  sale_price, discount_type, discount_value, allow_offers, is_featured,
  intake_date, quantity_total, quantity_available, quantity_reserved, quantity_sold,
  status, origin_notes, created_by, updated_by
) VALUES
  ('ART-0001', 'nike-windbreaker-azul-marino-l', 'Nike Windbreaker Azul Marino', @cat_camperas, @brand_nike, @size_l, NULL, 'Pecho 63 cm / Largo 72 cm', 'Rompeviento liviano con logo bordado y cierre frontal.', 320.00, 80.00, 120.00, 1590.00, 'NONE', 0.00, 1, 1, '2026-03-01', 1, 1, 0, 0, 'ACTIVE', 'Comprada en thrift de Miami.', @admin_user_id, @admin_user_id),
  ('ART-0002', 'adidas-hoodie-gris-m', 'Adidas Hoodie Gris Mélange', @cat_buzos, @brand_adidas, @size_m, NULL, 'Pecho 58 cm / Largo 68 cm', 'Buzo con capucha, bolsillo canguro y fit relajado.', 410.00, 90.00, 120.00, 1790.00, 'PERCENT', 15.00, 0, 1, '2026-03-02', 1, 1, 0, 0, 'ACTIVE', 'Selección sportswear USA.', @admin_user_id, @admin_user_id),
  ('ART-0003', 'champion-tee-bordada-s', 'Champion Tee Bordada Blanca', @cat_remeras, @brand_champion, @size_s, NULL, 'Pecho 50 cm / Largo 66 cm', 'Remera blanca clásica con logo bordado en pecho.', 180.00, 60.00, 100.00, 890.00, 'NONE', 0.00, 1, 0, '2026-03-03', 1, 1, 0, 0, 'ACTIVE', 'Curada para línea básica.', @admin_user_id, @admin_user_id),
  ('ART-0004', 'levis-501-denim-38', 'Levis 501 Denim Azul 38', @cat_pantalones, @brand_levis, @size_38, NULL, 'Cintura 38 / Largo 104 cm', 'Jean recto vintage de lavado medio.', 520.00, 100.00, 130.00, 1990.00, 'NONE', 0.00, 0, 0, '2026-03-04', 1, 1, 0, 0, 'ACTIVE', 'Denim americano original.', @admin_user_id, @admin_user_id),
  ('ART-0005', 'new-balance-shorts-negros-m', 'New Balance Shorts Negros', @cat_shorts, @brand_nb, @size_m, NULL, 'Cintura 39 cm / Largo 44 cm', 'Short deportivo liviano con cintura elástica.', 150.00, 50.00, 90.00, 790.00, 'FIXED', 100.00, 0, 1, '2026-03-05', 1, 1, 0, 0, 'ACTIVE', 'Ideal para cápsula deportiva.', @admin_user_id, @admin_user_id),
  ('ART-0006', 'tommy-jacket-roja-xl', 'Tommy Hilfiger Jacket Roja XL', @cat_camperas, @brand_tommy, @size_xl, NULL, 'Pecho 67 cm / Largo 74 cm', 'Campera liviana color block con cierre metálico.', 430.00, 120.00, 120.00, 2190.00, 'NONE', 0.00, 1, 0, '2026-03-06', 1, 0, 1, 0, 'RESERVED', 'Reservada por checkout pendiente.', @admin_user_id, @admin_user_id),
  ('ART-0007', 'reebok-crewneck-verde-l', 'Reebok Crewneck Verde L', @cat_buzos, @brand_reebok, @size_l, NULL, 'Pecho 61 cm / Largo 70 cm', 'Crewneck verde vintage con bordado frontal.', 260.00, 70.00, 100.00, 1390.00, 'NONE', 0.00, 0, 0, '2026-03-07', 1, 0, 0, 1, 'SOLD_OUT', 'Vendido en demo seed.', @admin_user_id, @admin_user_id),
  ('ART-0008', 'russell-hoodie-azul-xl', 'Russell Athletic Hoodie Azul XL', @cat_buzos, @brand_russell, @size_xl, NULL, 'Pecho 65 cm / Largo 71 cm', 'Hoodie pesado con excelente caída.', 290.00, 80.00, 100.00, 1490.00, 'NONE', 0.00, 1, 0, '2026-03-08', 1, 1, 0, 0, 'INACTIVE', 'Desactivado para edición.', @admin_user_id, @admin_user_id),
  ('ART-0009', 'puma-track-pants-negro-m', 'Puma Track Pants Negro M', @cat_pantalones, @brand_puma, @size_m, NULL, 'Cintura 40 cm / Largo 101 cm', 'Pantalón deportivo con tiras laterales.', 250.00, 70.00, 100.00, 1290.00, 'NONE', 0.00, 1, 0, '2026-03-09', 1, 1, 0, 0, 'ACTIVE', 'Sportswear moderno.', @admin_user_id, @admin_user_id),
  ('ART-0010', 'nike-cap-beige-unico', 'Nike Cap Beige Unico', @cat_accesorios, @brand_nike, NULL, 'UNICO', 'Circunferencia regulable', 'Gorra beige con swoosh bordado.', 120.00, 40.00, 80.00, 690.00, 'NONE', 0.00, 1, 0, '2026-03-10', 1, 1, 0, 0, 'ACTIVE', 'Accesorio curado para completar look.', @admin_user_id, @admin_user_id)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  category_id = VALUES(category_id),
  brand_id = VALUES(brand_id),
  size_id = VALUES(size_id),
  size_text = VALUES(size_text),
  measurements_text = VALUES(measurements_text),
  description = VALUES(description),
  purchase_price_item = VALUES(purchase_price_item),
  purchase_price_shipping = VALUES(purchase_price_shipping),
  purchase_price_courier = VALUES(purchase_price_courier),
  sale_price = VALUES(sale_price),
  discount_type = VALUES(discount_type),
  discount_value = VALUES(discount_value),
  allow_offers = VALUES(allow_offers),
  is_featured = VALUES(is_featured),
  intake_date = VALUES(intake_date),
  quantity_total = VALUES(quantity_total),
  quantity_available = VALUES(quantity_available),
  quantity_reserved = VALUES(quantity_reserved),
  quantity_sold = VALUES(quantity_sold),
  status = VALUES(status),
  origin_notes = VALUES(origin_notes),
  updated_by = VALUES(updated_by);

SET @art_1 := (SELECT id FROM articles WHERE internal_code = 'ART-0001' LIMIT 1);
SET @art_2 := (SELECT id FROM articles WHERE internal_code = 'ART-0002' LIMIT 1);
SET @art_3 := (SELECT id FROM articles WHERE internal_code = 'ART-0003' LIMIT 1);
SET @art_4 := (SELECT id FROM articles WHERE internal_code = 'ART-0004' LIMIT 1);
SET @art_5 := (SELECT id FROM articles WHERE internal_code = 'ART-0005' LIMIT 1);
SET @art_6 := (SELECT id FROM articles WHERE internal_code = 'ART-0006' LIMIT 1);
SET @art_7 := (SELECT id FROM articles WHERE internal_code = 'ART-0007' LIMIT 1);
SET @art_8 := (SELECT id FROM articles WHERE internal_code = 'ART-0008' LIMIT 1);
SET @art_9 := (SELECT id FROM articles WHERE internal_code = 'ART-0009' LIMIT 1);
SET @art_10 := (SELECT id FROM articles WHERE internal_code = 'ART-0010' LIMIT 1);

INSERT INTO article_images (article_id, file_path, alt_text, sort_order, is_primary, created_by)
SELECT @art_1, '/uploads/articles/art-0001/front.jpg', 'Nike Windbreaker Azul Marino - frente', 1, 1, @admin_user_id
WHERE NOT EXISTS (SELECT 1 FROM article_images WHERE article_id = @art_1 AND file_path = '/uploads/articles/art-0001/front.jpg');
INSERT INTO article_images (article_id, file_path, alt_text, sort_order, is_primary, created_by)
SELECT @art_1, '/uploads/articles/art-0001/back.jpg', 'Nike Windbreaker Azul Marino - espalda', 2, 0, @admin_user_id
WHERE NOT EXISTS (SELECT 1 FROM article_images WHERE article_id = @art_1 AND file_path = '/uploads/articles/art-0001/back.jpg');

INSERT INTO article_images (article_id, file_path, alt_text, sort_order, is_primary, created_by)
SELECT @art_2, '/uploads/articles/art-0002/front.jpg', 'Adidas Hoodie Gris - frente', 1, 1, @admin_user_id
WHERE NOT EXISTS (SELECT 1 FROM article_images WHERE article_id = @art_2 AND file_path = '/uploads/articles/art-0002/front.jpg');
INSERT INTO article_images (article_id, file_path, alt_text, sort_order, is_primary, created_by)
SELECT @art_2, '/uploads/articles/art-0002/detail.jpg', 'Adidas Hoodie Gris - detalle logo', 2, 0, @admin_user_id
WHERE NOT EXISTS (SELECT 1 FROM article_images WHERE article_id = @art_2 AND file_path = '/uploads/articles/art-0002/detail.jpg');

INSERT INTO article_images (article_id, file_path, alt_text, sort_order, is_primary, created_by)
SELECT @art_3, '/uploads/articles/art-0003/front.jpg', 'Champion Tee Blanca - frente', 1, 1, @admin_user_id
WHERE NOT EXISTS (SELECT 1 FROM article_images WHERE article_id = @art_3 AND file_path = '/uploads/articles/art-0003/front.jpg');

INSERT INTO article_images (article_id, file_path, alt_text, sort_order, is_primary, created_by)
SELECT @art_4, '/uploads/articles/art-0004/front.jpg', 'Levis 501 Azul - frente', 1, 1, @admin_user_id
WHERE NOT EXISTS (SELECT 1 FROM article_images WHERE article_id = @art_4 AND file_path = '/uploads/articles/art-0004/front.jpg');

INSERT INTO article_images (article_id, file_path, alt_text, sort_order, is_primary, created_by)
SELECT @art_5, '/uploads/articles/art-0005/front.jpg', 'New Balance Shorts Negros - frente', 1, 1, @admin_user_id
WHERE NOT EXISTS (SELECT 1 FROM article_images WHERE article_id = @art_5 AND file_path = '/uploads/articles/art-0005/front.jpg');

INSERT INTO article_images (article_id, file_path, alt_text, sort_order, is_primary, created_by)
SELECT @art_6, '/uploads/articles/art-0006/front.jpg', 'Tommy Hilfiger Jacket Roja - frente', 1, 1, @admin_user_id
WHERE NOT EXISTS (SELECT 1 FROM article_images WHERE article_id = @art_6 AND file_path = '/uploads/articles/art-0006/front.jpg');

INSERT INTO article_images (article_id, file_path, alt_text, sort_order, is_primary, created_by)
SELECT @art_7, '/uploads/articles/art-0007/front.jpg', 'Reebok Crewneck Verde - frente', 1, 1, @admin_user_id
WHERE NOT EXISTS (SELECT 1 FROM article_images WHERE article_id = @art_7 AND file_path = '/uploads/articles/art-0007/front.jpg');

INSERT INTO article_images (article_id, file_path, alt_text, sort_order, is_primary, created_by)
SELECT @art_8, '/uploads/articles/art-0008/front.jpg', 'Russell Hoodie Azul - frente', 1, 1, @admin_user_id
WHERE NOT EXISTS (SELECT 1 FROM article_images WHERE article_id = @art_8 AND file_path = '/uploads/articles/art-0008/front.jpg');

INSERT INTO article_images (article_id, file_path, alt_text, sort_order, is_primary, created_by)
SELECT @art_9, '/uploads/articles/art-0009/front.jpg', 'Puma Track Pants Negro - frente', 1, 1, @admin_user_id
WHERE NOT EXISTS (SELECT 1 FROM article_images WHERE article_id = @art_9 AND file_path = '/uploads/articles/art-0009/front.jpg');

INSERT INTO article_images (article_id, file_path, alt_text, sort_order, is_primary, created_by)
SELECT @art_10, '/uploads/articles/art-0010/front.jpg', 'Nike Cap Beige - frente', 1, 1, @admin_user_id
WHERE NOT EXISTS (SELECT 1 FROM article_images WHERE article_id = @art_10 AND file_path = '/uploads/articles/art-0010/front.jpg');

-- =========================================================
-- 5) Import batches demo
-- =========================================================

INSERT INTO article_import_batches (
  batch_type, source_file_name, rows_received, rows_created, rows_updated, rows_failed,
  started_at, finished_at, status, notes, created_by
)
SELECT
  'CSV', 'catalogo_inicial_demo.csv', 6, 6, 0, 0,
  '2026-03-10 12:00:00', '2026-03-10 12:01:15', 'DONE', 'Carga inicial de catálogo demo.', @admin_user_id
WHERE NOT EXISTS (
  SELECT 1 FROM article_import_batches WHERE source_file_name = 'catalogo_inicial_demo.csv'
);

SET @batch_csv_id := (SELECT id FROM article_import_batches WHERE source_file_name = 'catalogo_inicial_demo.csv' LIMIT 1);

INSERT INTO article_import_batch_items (batch_id, import_row_number, article_id, action, raw_payload_json, error_message)
SELECT @batch_csv_id, 1, @art_1, 'CREATED', JSON_OBJECT('internal_code','ART-0001','title','Nike Windbreaker Azul Marino'), NULL
WHERE NOT EXISTS (
  SELECT 1 FROM article_import_batch_items WHERE batch_id = @batch_csv_id AND import_row_number = 1
);

INSERT INTO article_import_batch_items (batch_id, import_row_number, article_id, action, raw_payload_json, error_message)
SELECT @batch_csv_id, 2, @art_2, 'CREATED', JSON_OBJECT('internal_code','ART-0002','title','Adidas Hoodie Gris Mélange'), NULL
WHERE NOT EXISTS (
  SELECT 1 FROM article_import_batch_items WHERE batch_id = @batch_csv_id AND import_row_number = 2
);

-- =========================================================
-- 6) Carts demo
-- =========================================================

INSERT INTO carts (user_id, customer_id, session_token, status)
SELECT @customer_user_id, @customer_lucia_id, 'sess_demo_lucia_001', 'ACTIVE'
WHERE NOT EXISTS (
  SELECT 1 FROM carts WHERE session_token = 'sess_demo_lucia_001'
);

SET @cart_lucia_id := (SELECT id FROM carts WHERE session_token = 'sess_demo_lucia_001' LIMIT 1);

INSERT INTO cart_items (
  cart_id, article_id, quantity, unit_price_snapshot, discount_type_snapshot,
  discount_value_snapshot, final_unit_price_snapshot
)
SELECT @cart_lucia_id, @art_1, 1, 1590.00, 'NONE', 0.00, 1590.00
WHERE NOT EXISTS (
  SELECT 1 FROM cart_items WHERE cart_id = @cart_lucia_id AND article_id = @art_1
);

INSERT INTO cart_items (
  cart_id, article_id, quantity, unit_price_snapshot, discount_type_snapshot,
  discount_value_snapshot, final_unit_price_snapshot
)
SELECT @cart_lucia_id, @art_10, 1, 690.00, 'NONE', 0.00, 690.00
WHERE NOT EXISTS (
  SELECT 1 FROM cart_items WHERE cart_id = @cart_lucia_id AND article_id = @art_10
);

-- =========================================================
-- 7) Orders, order items and status history
-- =========================================================

INSERT INTO orders (
  order_number, customer_id, potential_customer_id, user_id, shipping_method_id,
  shipping_method_description_snapshot, shipping_cost_snapshot,
  payment_method, payment_status, order_status,
  subtotal_snapshot, discount_total_snapshot, total_snapshot,
  reserved_until, approved_at, cancelled_at, shipped_at,
  cancellation_reason, internal_notes, created_at, updated_at, created_by, updated_by
)
SELECT
  'ORD-20260315-0001', NULL, @potential_camila_id, NULL, @ship_mvd,
  'Cadeteria Montevideo', 180.00,
  'BANK_TRANSFER', 'PENDING', 'RESERVED',
  2190.00, 0.00, 2370.00,
  '2026-03-16 18:00:00', NULL, NULL, NULL,
  NULL, 'Reserva de 24h pendiente de confirmación de transferencia.', '2026-03-15 10:00:00', '2026-03-15 10:00:00', @admin_user_id, @admin_user_id
WHERE NOT EXISTS (
  SELECT 1 FROM orders WHERE order_number = 'ORD-20260315-0001'
);

INSERT INTO orders (
  order_number, customer_id, potential_customer_id, user_id, shipping_method_id,
  shipping_method_description_snapshot, shipping_cost_snapshot,
  payment_method, payment_status, order_status,
  subtotal_snapshot, discount_total_snapshot, total_snapshot,
  reserved_until, approved_at, cancelled_at, shipped_at,
  cancellation_reason, internal_notes, created_at, updated_at, created_by, updated_by
)
SELECT
  'ORD-20260314-0002', @customer_lucia_id, NULL, @customer_user_id, @ship_dac,
  'DAC interior', 260.00,
  'MERCADO_PAGO', 'PAID', 'SHIPPED',
  1390.00, 0.00, 1650.00,
  '2026-03-14 11:00:00', '2026-03-14 10:20:00', NULL, '2026-03-14 15:30:00',
  NULL, 'Orden demo ya enviada.', '2026-03-14 09:45:00', '2026-03-14 15:30:00', @admin_user_id, @operator_user_id
WHERE NOT EXISTS (
  SELECT 1 FROM orders WHERE order_number = 'ORD-20260314-0002'
);

INSERT INTO orders (
  order_number, customer_id, potential_customer_id, user_id, shipping_method_id,
  shipping_method_description_snapshot, shipping_cost_snapshot,
  payment_method, payment_status, order_status,
  subtotal_snapshot, discount_total_snapshot, total_snapshot,
  reserved_until, approved_at, cancelled_at, shipped_at,
  cancellation_reason, internal_notes, created_at, updated_at, created_by, updated_by
)
SELECT
  'ORD-20260313-0003', @customer_martin_id, NULL, NULL, @ship_pickup,
  'Retiro en punto acordado', 0.00,
  'BANK_TRANSFER', 'FAILED', 'CANCELLED',
  890.00, 0.00, 890.00,
  '2026-03-13 18:00:00', NULL, '2026-03-13 19:10:00', NULL,
  'No se recibió comprobante dentro del plazo de reserva.', 'Orden cancelada de ejemplo.', '2026-03-13 15:00:00', '2026-03-13 19:10:00', @admin_user_id, @operator_user_id
WHERE NOT EXISTS (
  SELECT 1 FROM orders WHERE order_number = 'ORD-20260313-0003'
);

SET @ord_1 := (SELECT id FROM orders WHERE order_number = 'ORD-20260315-0001' LIMIT 1);
SET @ord_2 := (SELECT id FROM orders WHERE order_number = 'ORD-20260314-0002' LIMIT 1);
SET @ord_3 := (SELECT id FROM orders WHERE order_number = 'ORD-20260313-0003' LIMIT 1);

INSERT INTO order_items (
  order_id, article_id, quantity, article_title_snapshot, article_slug_snapshot, category_name_snapshot,
  brand_name_snapshot, size_snapshot, measurements_snapshot, image_snapshot,
  sale_price_snapshot, discount_type_snapshot, discount_value_snapshot,
  final_unit_price_snapshot, line_total_snapshot
)
SELECT
  @ord_1, @art_6, 1, 'Tommy Hilfiger Jacket Roja XL', 'tommy-jacket-roja-xl', 'Camperas',
  'Tommy Hilfiger', 'XL', 'Pecho 67 cm / Largo 74 cm', '/uploads/articles/art-0006/front.jpg',
  2190.00, 'NONE', 0.00, 2190.00, 2190.00
WHERE NOT EXISTS (
  SELECT 1 FROM order_items WHERE order_id = @ord_1 AND article_title_snapshot = 'Tommy Hilfiger Jacket Roja XL'
);

INSERT INTO order_items (
  order_id, article_id, quantity, article_title_snapshot, article_slug_snapshot, category_name_snapshot,
  brand_name_snapshot, size_snapshot, measurements_snapshot, image_snapshot,
  sale_price_snapshot, discount_type_snapshot, discount_value_snapshot,
  final_unit_price_snapshot, line_total_snapshot
)
SELECT
  @ord_2, @art_7, 1, 'Reebok Crewneck Verde L', 'reebok-crewneck-verde-l', 'Buzos',
  'Reebok', 'L', 'Pecho 61 cm / Largo 70 cm', '/uploads/articles/art-0007/front.jpg',
  1390.00, 'NONE', 0.00, 1390.00, 1390.00
WHERE NOT EXISTS (
  SELECT 1 FROM order_items WHERE order_id = @ord_2 AND article_title_snapshot = 'Reebok Crewneck Verde L'
);

INSERT INTO order_items (
  order_id, article_id, quantity, article_title_snapshot, article_slug_snapshot, category_name_snapshot,
  brand_name_snapshot, size_snapshot, measurements_snapshot, image_snapshot,
  sale_price_snapshot, discount_type_snapshot, discount_value_snapshot,
  final_unit_price_snapshot, line_total_snapshot
)
SELECT
  @ord_3, @art_3, 1, 'Champion Tee Bordada Blanca', 'champion-tee-bordada-s', 'Remeras',
  'Champion', 'S', 'Pecho 50 cm / Largo 66 cm', '/uploads/articles/art-0003/front.jpg',
  890.00, 'NONE', 0.00, 890.00, 890.00
WHERE NOT EXISTS (
  SELECT 1 FROM order_items WHERE order_id = @ord_3 AND article_title_snapshot = 'Champion Tee Bordada Blanca'
);

INSERT INTO order_status_history (order_id, from_status, to_status, reason, changed_at, changed_by, source)
SELECT @ord_1, NULL, 'PENDING', 'Creación inicial de la orden.', '2026-03-15 10:00:00', @admin_user_id, 'BACKOFFICE'
WHERE NOT EXISTS (
  SELECT 1 FROM order_status_history WHERE order_id = @ord_1 AND to_status = 'PENDING' AND changed_at = '2026-03-15 10:00:00'
);

INSERT INTO order_status_history (order_id, from_status, to_status, reason, changed_at, changed_by, source)
SELECT @ord_1, 'PENDING', 'RESERVED', 'Stock reservado por 24 horas.', '2026-03-15 10:02:00', @admin_user_id, 'SYSTEM'
WHERE NOT EXISTS (
  SELECT 1 FROM order_status_history WHERE order_id = @ord_1 AND to_status = 'RESERVED' AND changed_at = '2026-03-15 10:02:00'
);

INSERT INTO order_status_history (order_id, from_status, to_status, reason, changed_at, changed_by, source)
SELECT @ord_2, NULL, 'PENDING', 'Creación inicial de la orden.', '2026-03-14 09:45:00', @customer_user_id, 'FRONTEND'
WHERE NOT EXISTS (
  SELECT 1 FROM order_status_history WHERE order_id = @ord_2 AND to_status = 'PENDING' AND changed_at = '2026-03-14 09:45:00'
);

INSERT INTO order_status_history (order_id, from_status, to_status, reason, changed_at, changed_by, source)
SELECT @ord_2, 'PENDING', 'APPROVED', 'Pago confirmado por Mercado Pago.', '2026-03-14 10:20:00', @admin_user_id, 'BACKOFFICE'
WHERE NOT EXISTS (
  SELECT 1 FROM order_status_history WHERE order_id = @ord_2 AND to_status = 'APPROVED' AND changed_at = '2026-03-14 10:20:00'
);

INSERT INTO order_status_history (order_id, from_status, to_status, reason, changed_at, changed_by, source)
SELECT @ord_2, 'APPROVED', 'SHIPPED', 'Despacho generado y enviado al cliente.', '2026-03-14 15:30:00', @operator_user_id, 'BACKOFFICE'
WHERE NOT EXISTS (
  SELECT 1 FROM order_status_history WHERE order_id = @ord_2 AND to_status = 'SHIPPED' AND changed_at = '2026-03-14 15:30:00'
);

INSERT INTO order_status_history (order_id, from_status, to_status, reason, changed_at, changed_by, source)
SELECT @ord_3, NULL, 'PENDING', 'Creación inicial de la orden.', '2026-03-13 15:00:00', @admin_user_id, 'BACKOFFICE'
WHERE NOT EXISTS (
  SELECT 1 FROM order_status_history WHERE order_id = @ord_3 AND to_status = 'PENDING' AND changed_at = '2026-03-13 15:00:00'
);

INSERT INTO order_status_history (order_id, from_status, to_status, reason, changed_at, changed_by, source)
SELECT @ord_3, 'PENDING', 'CANCELLED', 'No se recibió comprobante dentro del plazo.', '2026-03-13 19:10:00', @operator_user_id, 'BACKOFFICE'
WHERE NOT EXISTS (
  SELECT 1 FROM order_status_history WHERE order_id = @ord_3 AND to_status = 'CANCELLED' AND changed_at = '2026-03-13 19:10:00'
);

-- =========================================================
-- 8) Offers and offer history
-- =========================================================

INSERT INTO offers (
  article_id, customer_id, potential_customer_id, offered_price, currency_code,
  status, expires_at, accepted_at, rejected_at, cancelled_at, notes,
  created_at, updated_at, created_by, updated_by
)
SELECT
  @art_1, NULL, @potential_camila_id, 1350.00, 'UYU',
  'PENDING', '2026-03-16 12:00:00', NULL, NULL, NULL, 'Oferta pendiente en windbreaker Nike.',
  '2026-03-15 11:20:00', '2026-03-15 11:20:00', NULL, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM offers WHERE article_id = @art_1 AND potential_customer_id = @potential_camila_id AND offered_price = 1350.00
);

INSERT INTO offers (
  article_id, customer_id, potential_customer_id, offered_price, currency_code,
  status, expires_at, accepted_at, rejected_at, cancelled_at, notes,
  created_at, updated_at, created_by, updated_by
)
SELECT
  @art_3, @customer_lucia_id, NULL, 780.00, 'UYU',
  'ACCEPTED', '2026-03-14 20:00:00', '2026-03-14 16:45:00', NULL, NULL, 'Oferta aceptada manualmente en backoffice.',
  '2026-03-14 16:00:00', '2026-03-14 16:45:00', @admin_user_id, @admin_user_id
WHERE NOT EXISTS (
  SELECT 1 FROM offers WHERE article_id = @art_3 AND customer_id = @customer_lucia_id AND offered_price = 780.00
);

SET @offer_1 := (SELECT id FROM offers WHERE article_id = @art_1 AND potential_customer_id = @potential_camila_id AND offered_price = 1350.00 LIMIT 1);
SET @offer_2 := (SELECT id FROM offers WHERE article_id = @art_3 AND customer_id = @customer_lucia_id AND offered_price = 780.00 LIMIT 1);

INSERT INTO offer_status_history (offer_id, from_status, to_status, reason, changed_at, changed_by, source)
SELECT @offer_1, NULL, 'PENDING', 'Oferta creada desde la vista pública.', '2026-03-15 11:20:00', NULL, 'FRONTEND'
WHERE NOT EXISTS (
  SELECT 1 FROM offer_status_history WHERE offer_id = @offer_1 AND to_status = 'PENDING' AND changed_at = '2026-03-15 11:20:00'
);

INSERT INTO offer_status_history (offer_id, from_status, to_status, reason, changed_at, changed_by, source)
SELECT @offer_2, NULL, 'PENDING', 'Oferta creada por cliente registrado.', '2026-03-14 16:00:00', @customer_user_id, 'FRONTEND'
WHERE NOT EXISTS (
  SELECT 1 FROM offer_status_history WHERE offer_id = @offer_2 AND to_status = 'PENDING' AND changed_at = '2026-03-14 16:00:00'
);

INSERT INTO offer_status_history (offer_id, from_status, to_status, reason, changed_at, changed_by, source)
SELECT @offer_2, 'PENDING', 'ACCEPTED', 'Oferta aceptada por admin.', '2026-03-14 16:45:00', @admin_user_id, 'BACKOFFICE'
WHERE NOT EXISTS (
  SELECT 1 FROM offer_status_history WHERE offer_id = @offer_2 AND to_status = 'ACCEPTED' AND changed_at = '2026-03-14 16:45:00'
);

-- =========================================================
-- 9) Payments
-- =========================================================

INSERT INTO payments (
  order_id, payment_method, provider_name, provider_reference, amount,
  currency_code, status, paid_at, raw_response_json, created_at, updated_at, created_by, updated_by
)
SELECT
  @ord_1, 'BANK_TRANSFER', 'Manual Transfer', 'TRX-DEMO-0001', 2370.00,
  'UYU', 'PENDING', NULL, JSON_OBJECT('bank','BROU','requires_receipt', true),
  '2026-03-15 10:03:00', '2026-03-15 10:03:00', @admin_user_id, @admin_user_id
WHERE NOT EXISTS (
  SELECT 1 FROM payments WHERE order_id = @ord_1 AND provider_reference = 'TRX-DEMO-0001'
);

INSERT INTO payments (
  order_id, payment_method, provider_name, provider_reference, amount,
  currency_code, status, paid_at, raw_response_json, created_at, updated_at, created_by, updated_by
)
SELECT
  @ord_2, 'MERCADO_PAGO', 'Mercado Pago', 'MP-DEMO-0002', 1650.00,
  'UYU', 'APPROVED', '2026-03-14 10:18:00', JSON_OBJECT('status_detail','approved','collector_id','demo_collector_01'),
  '2026-03-14 10:18:00', '2026-03-14 10:18:00', @admin_user_id, @admin_user_id
WHERE NOT EXISTS (
  SELECT 1 FROM payments WHERE order_id = @ord_2 AND provider_reference = 'MP-DEMO-0002'
);

INSERT INTO payments (
  order_id, payment_method, provider_name, provider_reference, amount,
  currency_code, status, paid_at, raw_response_json, created_at, updated_at, created_by, updated_by
)
SELECT
  @ord_3, 'BANK_TRANSFER', 'Manual Transfer', 'TRX-DEMO-0003', 890.00,
  'UYU', 'FAILED', NULL, JSON_OBJECT('reason','receipt_not_received'),
  '2026-03-13 18:40:00', '2026-03-13 19:10:00', @admin_user_id, @operator_user_id
WHERE NOT EXISTS (
  SELECT 1 FROM payments WHERE order_id = @ord_3 AND provider_reference = 'TRX-DEMO-0003'
);

-- =========================================================
-- 10) Contact messages
-- =========================================================

INSERT INTO contact_messages (
  first_name, last_name, birth_date, phone, instagram, email, message_text,
  status, created_at, updated_at, handled_by
)
SELECT
  'Valentina', 'Consulta', '2002-09-09', '099100006', '@vale.secondhand', 'valentina.consulta@test.com',
  'Hola, quisiera saber si la campera Nike tiene algún detalle visible.',
  'NEW', '2026-03-15 09:30:00', '2026-03-15 09:30:00', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM contact_messages WHERE email = 'valentina.consulta@test.com' AND created_at = '2026-03-15 09:30:00'
);

INSERT INTO contact_messages (
  first_name, last_name, birth_date, phone, instagram, email, message_text,
  status, created_at, updated_at, handled_by
)
SELECT
  'Bruno', 'Talles', '1998-01-21', '099100007', '@bruno.uy', 'bruno.talles@test.com',
  '¿Van a subir más pantalones deportivos en talle M?',
  'READ', '2026-03-14 18:10:00', '2026-03-14 18:30:00', @operator_user_id
WHERE NOT EXISTS (
  SELECT 1 FROM contact_messages WHERE email = 'bruno.talles@test.com' AND created_at = '2026-03-14 18:10:00'
);

-- =========================================================
-- 11) Audit log demo
-- =========================================================

INSERT INTO audit_log (
  actor_user_id, actor_label, action_code, entity_type, entity_id,
  before_json, after_json, metadata_json, source, ip_address, user_agent, created_at
)
SELECT
  @admin_user_id, 'Admin Miami Closet', 'ARTICLE_CREATED', 'articles', @art_1,
  NULL,
  JSON_OBJECT('internal_code','ART-0001','status','ACTIVE','sale_price',1590.00),
  JSON_OBJECT('module','backoffice','note','seed demo'),
  'BACKOFFICE', '127.0.0.1', 'seed-script', '2026-03-10 12:00:10'
WHERE NOT EXISTS (
  SELECT 1 FROM audit_log WHERE action_code = 'ARTICLE_CREATED' AND entity_type = 'articles' AND entity_id = @art_1 AND created_at = '2026-03-10 12:00:10'
);

INSERT INTO audit_log (
  actor_user_id, actor_label, action_code, entity_type, entity_id,
  before_json, after_json, metadata_json, source, ip_address, user_agent, created_at
)
SELECT
  @admin_user_id, 'Admin Miami Closet', 'ORDER_CREATED', 'orders', @ord_1,
  NULL,
  JSON_OBJECT('order_number','ORD-20260315-0001','order_status','RESERVED','total_snapshot',2370.00),
  JSON_OBJECT('module','checkout','reservation_hours',24),
  'SYSTEM', '127.0.0.1', 'seed-script', '2026-03-15 10:02:00'
WHERE NOT EXISTS (
  SELECT 1 FROM audit_log WHERE action_code = 'ORDER_CREATED' AND entity_type = 'orders' AND entity_id = @ord_1 AND created_at = '2026-03-15 10:02:00'
);

INSERT INTO audit_log (
  actor_user_id, actor_label, action_code, entity_type, entity_id,
  before_json, after_json, metadata_json, source, ip_address, user_agent, created_at
)
SELECT
  @operator_user_id, 'Sofia Operaciones', 'ORDER_SHIPPED', 'orders', @ord_2,
  JSON_OBJECT('order_status','APPROVED'),
  JSON_OBJECT('order_status','SHIPPED','shipped_at','2026-03-14 15:30:00'),
  JSON_OBJECT('tracking_mode','manual_demo'),
  'BACKOFFICE', '127.0.0.1', 'seed-script', '2026-03-14 15:30:00'
WHERE NOT EXISTS (
  SELECT 1 FROM audit_log WHERE action_code = 'ORDER_SHIPPED' AND entity_type = 'orders' AND entity_id = @ord_2 AND created_at = '2026-03-14 15:30:00'
);

COMMIT;

-- =========================================================
-- Quick reference
-- Admin:       admin@miamicloset.test / 123456
-- Operaciones: operaciones@miamicloset.test / 123456
-- Cliente:     lucia.cliente@test.com / 123456
-- =========================================================
