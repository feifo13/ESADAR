# ESADAR Backend

Backend base en Express + MySQL para la tienda curada de segunda mano.

## Incluye

- Auth con JWT (`login`, `register`, `me`)
- Listado público y detalle de artículos
- CRUD base de artículos para backoffice
- Subida de imágenes de artículos
- Creación de órdenes con reserva de stock por 24h
- Acciones backoffice sobre órdenes (`approve`, `cancel`, `ship`)
- Auditoría central en `audit_log`

## Requisitos

- Node 20+
- MySQL con el schema y seed ya importados

## Instalación

```bash
npm install
cp .env.example .env
npm run dev
```

## Variables de entorno

Ver `.env.example`.

## Rutas principales

### Health
- `GET /api/health`

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Artículos públicos
- `GET /api/public/articles`
- `GET /api/public/articles/:slugOrId`

### Artículos backoffice
- `GET /api/admin/articles`
- `GET /api/admin/articles/:id`
- `POST /api/admin/articles`
- `PUT /api/admin/articles/:id`
- `PATCH /api/admin/articles/:id/status`
- `POST /api/admin/articles/:id/images`

### Órdenes
- `POST /api/public/orders`
- `GET /api/admin/orders`
- `GET /api/admin/orders/:id`
- `PATCH /api/admin/orders/:id/approve`
- `PATCH /api/admin/orders/:id/cancel`
- `PATCH /api/admin/orders/:id/ship`

### Auditoría
- `GET /api/admin/audit`

## Roles esperados

- `SUPER_ADMIN`
- `ADMIN`
- `OPERATOR`
- `CUSTOMER`

## Notas

- La lógica de auditoría escribe en `audit_log`.
- La creación de órdenes reserva stock inmediatamente por 24 horas.
- El checkout soporta usuario autenticado o comprador invitado.
- Las ofertas no están implementadas aún en este starter, pero la estructura ya queda preparada para el siguiente paso.
