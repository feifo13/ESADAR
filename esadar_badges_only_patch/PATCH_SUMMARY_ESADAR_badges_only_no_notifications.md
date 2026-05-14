# ESADAR badges-only patch

Este patch elimina la capa de notificaciones visuales agregada en la iteración anterior y conserva solamente los cambios de badges/indicadores en:

- cards/listado de artículos
- galería/vista de artículo
- alertas de oferta aceptada y artículo en carrito

Archivos incluidos para revertir la capa de notificaciones:

- `frontend/src/main.jsx`
- `frontend/src/components/Header.jsx`
- `frontend/src/components/admin/AdminToolbar.jsx`
- `frontend/src/pages/AccountPage.jsx`
- `frontend/src/pages/admin/AdminOffersPage.jsx`
- `frontend/src/pages/admin/AdminOrdersPage.jsx`
- `frontend/src/pages/admin/AdminOrderDetailPage.jsx`

Archivos que mantienen los cambios visuales deseados:

- `frontend/src/components/ArticleCard.jsx`
- `frontend/src/pages/ArticlePage.jsx`
- `frontend/src/index.css`

Si ya se había aplicado el patch de notificaciones, ejecutar:

```bash
bash cleanup_remove_action_notifications.sh
```

Validado con:

```bash
cd frontend
npm run build
```
