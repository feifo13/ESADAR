# ESADAR Frontend

Frontend React + Vite para la tienda curada de segunda mano ESADAR.

## Requisitos

- Node 20+
- Backend funcionando localmente en `http://localhost:4000`
- Base de datos con schema y seed importados

## Instalación local

```bash
npm install
cp .env.example .env.local
npm run dev
```

La app usa URLs relativas por defecto:

- API: `/api/*`
- uploads/assets: `/uploads/*`

En local, Vite proxyea `/api` y `/uploads` hacia `http://localhost:4000`.
En sandbox/producción, Nginx proxyea `/api` y `/uploads` hacia el backend real.

Esto evita hardcodear `localhost`, la IP de Lightsail o dominios dentro del código fuente.

## Variables de entorno frontend

Normalmente pueden quedar vacías:

```bash
VITE_API_URL=
VITE_PUBLIC_SITE_URL=
VITE_DEV_API_PROXY_TARGET=http://localhost:4000
```

Usá `.env.local` para tu PC y `.env.production.local` solo si necesitás sobrescribir algo en el servidor. Estos archivos no deben commitearse.

## Credenciales demo

- `admin@miamicloset.test` / `123456`
- `operaciones@miamicloset.test` / `123456`
- `lucia.cliente@test.com` / `123456`

## Rutas principales

### Públicas
- `/`
- `/articles/:slugOrId`
- `/articles/:slugOrId/offer`
- `/login`
- `/register`
- `/checkout`
- `/contact`
- `/about`

### Backoffice
- `/admin/articles`
- `/admin/articles/new`
- `/admin/articles/:id/edit`
- `/admin/orders`
- `/admin/orders/:id`
