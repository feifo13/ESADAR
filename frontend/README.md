# ESADAR Frontend

Starter de frontend en React + Vite para la tienda curada de segunda mano.

## Incluye

- Landing pública conectada al backend real
- Listado de artículos con filtros y vista grilla/lista
- Detalle de artículo con galería
- Vista de ofertar artículo (UI preparada)
- Carrito y checkout con compra autenticada o invitada
- Login y registro
- Backoffice inicial para artículos y órdenes
- Tipografía IBM Plex Sans
- Paleta inspirada en Miami Dolphins
- Toggle entre modo default y alternativo

## Requisitos

- Node 20+
- Backend starter funcionando en `http://localhost:4000`
- Base de datos con schema y seed importados

## Instalación

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Variable de entorno

```bash
VITE_API_URL=http://localhost:4000
```

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

## Notas importantes del starter

- La vista de ofertas ya está diseñada, pero el backend de ofertas todavía no está conectado.
- Los selects de categorías, marcas, talles y métodos de envío usan constantes locales alineadas con el seed demo.
- Cuando agregues endpoints de lookup (`/categories`, `/brands`, `/sizes`, `/shipping-methods`), podrás reemplazar esas constantes por datos reales.
- El checkout usa los endpoints de órdenes ya implementados en el backend starter.
