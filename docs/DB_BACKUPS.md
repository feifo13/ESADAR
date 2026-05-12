# Backups diarios de base de datos ESADAR

Este proyecto incluye un script operativo para generar dumps comprimidos de MySQL sin exponer la contraseña en consola.

## Variables usadas

El script lee las variables habituales del backend:

- `DB_HOST`
- `DB_PORT` opcional, default `3306`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

Variables opcionales:

- `BACKUP_DIR`: carpeta destino. Si no se define, usa `../backups` desde `backend`.
- `BACKUP_RETENTION_DAYS`: días de retención. Default `30`.

## Ejecutar manualmente

Desde el backend:

```bash
cd /var/www/esadar-sandbox/backend
npm run db:backup
```

El archivo generado tendrá formato:

```text
esadar-DBNAME-YYYY-MM-DD-HH-mm-ss.sql.gz
```

## Cron recomendado para Lightsail / Ubuntu

Editar crontab:

```bash
crontab -e
```

Agregar:

```bash
0 3 * * * cd /var/www/esadar-sandbox/backend && npm run db:backup >> /var/log/esadar-db-backup.log 2>&1
```

## Restore seguro

No modifiques ni descomprimas el backup original. Copialo a una carpeta de trabajo y restaurá desde esa copia:

```bash
mkdir -p /home/ubuntu/esadar-restore-work
cp /var/backups/esadar/esadar-DBNAME-YYYY-MM-DD-HH-mm-ss.sql.gz /home/ubuntu/esadar-restore-work/latest.sql.gz
zcat /home/ubuntu/esadar-restore-work/latest.sql.gz | mysql -h "$DB_HOST" -u "$DB_USER" -p "$DB_NAME"
```

Registrar siempre qué archivo se usó para restaurar y en qué base se aplicó.
