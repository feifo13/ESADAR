-- Creacion completa de base ESADAR desde cero.
-- Ejecutar desde la raiz del repo para que SOURCE encuentre db/schema.sql y db/seed.sql.
--
-- Uso:
--   mysql -u <usuario> -p < db/scripts/crear-base-from-scratch.sql
--
-- Ajusta el nombre de base si necesitas otro distinto de `esadar`.

DROP DATABASE IF EXISTS esadar;
CREATE DATABASE esadar
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE esadar;

SOURCE db/schema.sql;
SOURCE db/seed.sql;
