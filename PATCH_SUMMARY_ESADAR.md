# ESADAR patch summary

Cambios aplicados sobre el ZIP entregado:

- Mails: helpers centralizados para URLs públicas, orden, prenda, cuenta, login y reset de contraseña.
- Loader: componente `AppLoader` con logo girando y reemplazo de textos visibles de carga.
- Footer: guardas para evitar aparición/pestañeo durante carga, intro y navegación.
- Galerías: una sola imagen ahora se muestra como principal y miniatura activa.
- Frontend logging: `ErrorBoundary`, listeners globales y logger sanitizado hacia `/api/client-logs`.
- Backend logging: módulo `client-logs`, endpoint público rate-limited y endpoint admin de consulta.
- DB: migración `client_error_logs` y actualización de `db/schema.sql`.
- Backups: script `backend/scripts/backup-db.mjs`, script npm `db:backup` y documentación `docs/DB_BACKUPS.md`.
- Theme: primer paint y contexto fijados a `sharp-lab-light-01` + Neo Grotesk; limpieza de storage legacy.
- Admin artículos: acción de eliminación real segura, manteniendo desactivación como alternativa histórica.
- Oferta: badges/ribbons de oferta forzados a naranja.
- Admin toolbar: grupos izquierda/derecha en desktop y comportamiento responsive en mobile.
- Admin usuarios: vista `/admin/users/:id/edit`, endpoints GET/PUT, validaciones y auditoría `USER_UPDATED`.

Validaciones ejecutadas:

- `cd frontend && npm run check:imports`
- `cd frontend && npm run build`
- `cd backend && node --check src/server.js`
- `cd backend && find src scripts -name '*.js' -o -name '*.mjs' | xargs -n1 node --check`
- `cd backend && node --test tests/*.test.js`

Migración nueva:

```sql
SOURCE db/migrations/2026-05-12-001-client-error-logs.sql;
```

Backup diario recomendado:

```bash
0 3 * * * cd /var/www/esadar-sandbox/backend && npm run db:backup >> /var/log/esadar-db-backup.log 2>&1
```
