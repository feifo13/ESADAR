-- =========================================================
-- ESADAR - Hardening de identidad, contacto y dirección
-- Fecha: 2026-08-21
-- Estrategia legacy:
--   - No transforma ni inventa datos históricos.
--   - Habilita nombres ausentes para primer login Google.
--   - Agrega dirección estructurada a prospects y snapshots a órdenes.
--   - El contrato de nuevos writes queda aplicado por la API.
-- =========================================================

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET collation_connection = 'utf8mb4_unicode_ci';
SET time_zone = '+00:00';

ALTER TABLE users
  MODIFY COLUMN first_name VARCHAR(100) NULL,
  MODIFY COLUMN last_name VARCHAR(100) NULL;

ALTER TABLE customers
  MODIFY COLUMN first_name VARCHAR(100) NULL,
  MODIFY COLUMN last_name VARCHAR(100) NULL;

ALTER TABLE potential_customers
  MODIFY COLUMN first_name VARCHAR(100) NULL,
  MODIFY COLUMN last_name VARCHAR(100) NULL,
  ADD COLUMN address_line VARCHAR(255) NULL AFTER address,
  ADD COLUMN city VARCHAR(120) NULL AFTER address_line,
  ADD COLUMN state VARCHAR(120) NULL AFTER city,
  ADD COLUMN country VARCHAR(120) NULL AFTER state,
  ADD COLUMN postal_code VARCHAR(30) NULL AFTER country,
  ADD COLUMN dwelling_type ENUM('HOUSE','APARTMENT') NULL AFTER postal_code,
  ADD COLUMN apartment VARCHAR(80) NULL AFTER dwelling_type,
  ADD COLUMN delivery_notes TEXT NULL AFTER apartment;

ALTER TABLE customer_addresses
  ADD COLUMN dwelling_type ENUM('HOUSE','APARTMENT') NULL AFTER postal_code,
  ADD COLUMN apartment VARCHAR(80) NULL AFTER dwelling_type;

ALTER TABLE orders
  ADD COLUMN customer_first_name_snapshot VARCHAR(100) NULL AFTER total_snapshot,
  ADD COLUMN customer_last_name_snapshot VARCHAR(100) NULL AFTER customer_first_name_snapshot,
  ADD COLUMN customer_email_snapshot VARCHAR(255) NULL AFTER customer_last_name_snapshot,
  ADD COLUMN customer_phone_snapshot VARCHAR(50) NULL AFTER customer_email_snapshot,
  ADD COLUMN customer_address_line_snapshot VARCHAR(255) NULL AFTER customer_phone_snapshot,
  ADD COLUMN customer_city_snapshot VARCHAR(120) NULL AFTER customer_address_line_snapshot,
  ADD COLUMN customer_state_snapshot VARCHAR(120) NULL AFTER customer_city_snapshot,
  ADD COLUMN customer_country_snapshot VARCHAR(120) NULL AFTER customer_state_snapshot,
  ADD COLUMN customer_postal_code_snapshot VARCHAR(30) NULL AFTER customer_country_snapshot,
  ADD COLUMN customer_dwelling_type_snapshot ENUM('HOUSE','APARTMENT') NULL AFTER customer_postal_code_snapshot,
  ADD COLUMN customer_apartment_snapshot VARCHAR(80) NULL AFTER customer_dwelling_type_snapshot,
  ADD COLUMN customer_delivery_notes_snapshot TEXT NULL AFTER customer_apartment_snapshot;
