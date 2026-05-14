# ESADAR - Workflow humano para sandbox y produccion

Este documento es la guia operativa unica fuera de `docs/`. La carpeta `docs/` se conserva como referencia tecnica puntual:

- `docs/DB_BACKUPS.md`: backups y restores de base de datos.
- `docs/LIGHTSAIL_NGINX_PERFORMANCE.md`: Nginx, gzip, cache y proxies.
- `docs/MERCADO_PAGO_SETUP.md`: Checkout Pro, credenciales y webhooks.

## Estado de congelamiento

El repo queda en freeze para desplegar primero a sandbox y despues a produccion. Durante el freeze:

- No se agregan features nuevas.
- Solo entran fixes bloqueantes o ajustes requeridos por la validacion de sandbox.
- Todo cambio debe quedar probado localmente y validado en sandbox antes de tocar produccion.
- No se commitean credenciales reales, backups, zips, diffs ni reportes temporales.
- Los documentos operativos viven en este archivo y en `docs/`.

## Estructura de la solucion

- `backend/`: API Express + MySQL. Expone `/api`, `/uploads` y assets publicos.
- `frontend/`: React + Vite. Usa rutas relativas para `/api` y `/uploads`.
- `db/scripts/`: scripts activos para preparar o resetear base.
- `docs/`: notas tecnicas que no deben borrarse durante esta limpieza.

## Requisitos

- Node.js 20 o superior.
- MySQL disponible y con credenciales correctas.
- Variables de entorno completas en `backend/.env`.
- Variables frontend en `frontend/.env.local` para desarrollo local, o archivo equivalente no versionado en servidor si hiciera falta.
- Nginx o proxy equivalente en sandbox/produccion para servir frontend y derivar `/api` y `/uploads` al backend.

## Comandos locales

Backend:

```bash
cd backend
npm install
npm run dev
```

Tests backend:

```bash
cd backend
npm test
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

QA frontend:

```bash
cd frontend
npm run test:qa
```

Build frontend:

```bash
cd frontend
npm run build
```

## Base de datos

Para preparar sandbox, usar solamente los scripts activos de `db/scripts/`:

- `01_from_scratch_superadmin_seed.sql`
- `02_vaciado_operativo_usuarios_stock100_seed.sql`
- `03_vaciado_operativo_solo_usuarios.sql`

Antes de resetear o migrar una base con datos utiles, hacer backup. El flujo detallado esta en `docs/DB_BACKUPS.md`.

## Validacion antes de sandbox

1. Confirmar que el arbol de trabajo esta limpio:

   ```bash
   git status
   ```

2. Instalar dependencias si cambia `package-lock.json`:

   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

3. Ejecutar backend:

   ```bash
   cd backend
   npm test
   ```

4. Ejecutar frontend:

   ```bash
   cd frontend
   npm run test:qa
   ```

5. Generar build:

   ```bash
   cd frontend
   npm run build
   ```

6. Revisar manualmente:
   - Home y catalogo.
   - Detalle de articulo.
   - Login y registro.
   - Checkout.
   - Backoffice de articulos y ordenes.
   - Contacto y emails criticos.

## Deploy a sandbox

1. Hacer backup de la base sandbox si ya tiene datos utiles.
2. Actualizar codigo en el servidor sandbox al commit congelado.
3. Revisar `backend/.env`:
   - `NODE_ENV`
   - `PORT`
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
   - `JWT_SECRET`
   - `PUBLIC_SITE_URL`
   - `CORS_ORIGINS`
   - SMTP
   - Mercado Pago en modo prueba
   - `TRUST_PROXY=true` si hay Nginx delante
4. Instalar dependencias:

   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

5. Si la base es nueva o debe resetearse, aplicar el script SQL correspondiente desde `db/scripts/`.
6. Construir frontend:

   ```bash
   cd frontend
   npm run build
   ```

7. Reiniciar el proceso backend con el gestor usado en el servidor.
8. Confirmar Nginx:
   - `/api/` proxyea al backend.
   - `/uploads/` proxyea al backend.
   - `/assets/` sirve estaticos con cache.
   - gzip esta activo.
9. Validar endpoints:

   ```bash
   curl https://TU-SANDBOX/api/health
   curl https://TU-SANDBOX/api/public/articles
   ```

10. Validar flujo completo:
    - Compra invitada.
    - Compra con usuario autenticado.
    - Orden con transferencia o Prex.
    - Orden con Mercado Pago prueba.
    - Webhook Mercado Pago en prueba.
    - Emails de registro, orden recibida, orden aprobada y contacto.

## Criterios para pasar a produccion

Produccion se toca solo cuando sandbox esta aprobado. Antes del corte:

- Backup de base productiva realizado y ubicacion registrada.
- Commit exacto identificado.
- Variables productivas revisadas.
- Mercado Pago cambiado a produccion con credenciales reales.
- `PUBLIC_SITE_URL` apunta al dominio real HTTPS.
- `CORS_ORIGINS` contiene solo origenes esperados.
- SMTP productivo validado.
- Nginx productivo conserva proxy, gzip y cache segun `docs/LIGHTSAIL_NGINX_PERFORMANCE.md`.

## Deploy a produccion

1. Anunciar ventana de despliegue.
2. Hacer backup de base productiva.
3. Actualizar codigo al commit aprobado en sandbox.
4. Instalar dependencias si corresponde.
5. Aplicar cambios de base solo si fueron validados en sandbox.
6. Construir frontend.
7. Reiniciar backend.
8. Recargar Nginx si cambio configuracion.
9. Ejecutar smoke test:
   - `/api/health`
   - catalogo publico
   - detalle de articulo
   - login admin
   - checkout sin pago real
   - configuracion de Mercado Pago
10. Registrar fecha, commit desplegado y resultado.

## Rollback

Rollback de codigo:

1. Volver al commit anterior estable.
2. Reinstalar dependencias si cambio lockfile.
3. Reconstruir frontend.
4. Reiniciar backend.
5. Revalidar `/api/health` y catalogo.

Rollback de base:

1. Usar solo si el cambio de base rompio datos o schema.
2. Restaurar desde el backup tomado antes del deploy.
3. Registrar archivo restaurado, hora y responsable.
4. Revalidar login, catalogo, checkout y backoffice.

## Operacion diaria minima

- Revisar logs de backend despues de deploy.
- Revisar errores de Nginx si hay 502, 404 inesperado o assets sin gzip.
- Mantener backups diarios segun `docs/DB_BACKUPS.md`.
- No subir `.env`, dumps, `.zip`, `.diff` ni reportes temporales.
- Si aparece documentacion nueva, moverla a `docs/` o consolidarla aqui.
