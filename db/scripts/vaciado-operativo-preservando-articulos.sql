-- Vaciado operativo para desarrollo/testing.
-- Preserva usuarios, roles, permisos, clientes registrados, datos maestros y articulos.
-- Limpia carritos, ordenes, ofertas, leads, contactos, wishlists, alertas, eventos, pagos, auditoria e importaciones.
--
-- Uso:
--   mysql -u <usuario> -p <base_esadar> < db/scripts/vaciado-operativo-preservando-articulos.sql

SET @OLD_FOREIGN_KEY_CHECKS := @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

START TRANSACTION;

DELETE FROM audit_log;
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

COMMIT;

-- ALTER TABLE hace commit implicito en MySQL; por eso va despues del bloque transaccional.
ALTER TABLE audit_log AUTO_INCREMENT = 1;
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
