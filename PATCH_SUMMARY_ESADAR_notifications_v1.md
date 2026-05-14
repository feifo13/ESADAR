# ESADAR notifications UX patch v1

Patch incremental para indicadores/notificaciones visuales de ofertas aceptadas, carrito, ordenes y admin.

## Archivos modificados/agregados

- frontend/src/main.jsx
- frontend/src/lib/notification-metrics.js
- frontend/src/contexts/ActionNotificationsContext.jsx
- frontend/src/components/Header.jsx
- frontend/src/components/admin/AdminToolbar.jsx
- frontend/src/components/ArticleCard.jsx
- frontend/src/pages/ArticlePage.jsx
- frontend/src/pages/AccountPage.jsx
- frontend/src/pages/admin/AdminOffersPage.jsx
- frontend/src/pages/admin/AdminOrdersPage.jsx
- frontend/src/pages/admin/AdminOrderDetailPage.jsx
- frontend/src/index.css

## Validacion

- `cd frontend && npm run build` OK.

## Alcance

- Badges naranjas para ofertas aceptadas.
- Badges azules para articulo ya presente en carrito.
- Indicadores en galeria de articulo y card de catalogo/destacados.
- Badges en tabs de `/cuenta` para ofertas aceptadas y ordenes con cambio de estado.
- Badges en toolbar admin para ofertas pendientes y ordenes nuevas/pendientes.
- Badge agregado al icono de cuenta/admin y al menu mobile.
- Recalculo de indicadores luego de acciones admin relevantes.

## Nota tecnica

Esta version usa endpoints ya existentes. No agrega tabla de notificaciones ni estado leido/no leido persistente en backend. Para una segunda fase se recomienda crear una tabla `notifications` con `read_at` por usuario/admin.
