# ESADAR — Article unavailable view + Prex transfer action

## Cambios incluidos

### 1. Vista pública para artículo no disponible
- `backend/src/modules/articles/articles.service.js`
  - El detalle público ahora puede devolver artículos existentes aunque estén `INACTIVE` o `RESERVED`.
  - Se agrega `article.isUnavailable` cuando el estado no es `ACTIVE` ni `SOLD_OUT`.
- `frontend/src/pages/ArticlePage.jsx`
  - Si el artículo existe pero no está disponible, se renderiza una vista específica:
    - mensaje “Artículo no disponible”,
    - imagen/galería del artículo,
    - marca/talle,
    - botón para volver al catálogo,
    - botón “Avisame si entra algo similar”,
    - rail de alternativas similares si existen.
  - No muestra botón de compra ni de oferta en ese estado.

### 2. Botón de transferencia Prex en `/checkout/completa`
- `backend/src/modules/orders/orders.controller.js`
  - La respuesta de creación de orden incluye `paymentInstructions` cuando el método de pago es `BANK_TRANSFER`.
  - Se reutilizan los datos configurados en `Admin > Collecting`.
- `frontend/src/pages/CheckoutPage.jsx`
  - Guarda en `sessionStorage` la orden completa necesaria para la pantalla final: número, total, método de pago e instrucciones de pago.
- `frontend/src/pages/CheckoutCompletePage.jsx`
  - Muestra un panel de transferencia cuando la orden se creó con transferencia bancaria/Prex.
  - Agrega botón “Abrir Prex y transferir”.
  - Muestra los datos ya cargados en collecting: titular, banco, tipo de cuenta, cuenta, sucursal, moneda, alias, documento/RUT, monto y referencia.
  - Agrega botones “Copiar” por dato para facilitar la transferencia.
  - Agrega link secundario a la guía oficial de cargas Prex.

### 3. CSS
- `frontend/src/index.css`
  - Estilos responsive para la vista de artículo no disponible.
  - Estilos responsive para el panel de transferencia en checkout completo.

## Validaciones realizadas
- `frontend`: `npm run build` ejecutado correctamente.
- `backend`: `node --check` ejecutado correctamente sobre:
  - `src/modules/orders/orders.controller.js`
  - `src/modules/articles/articles.service.js`
- `backend`: no tiene script `npm test` definido en `package.json`, por eso no se ejecutaron tests automáticos.

## Nota sobre Prex
Prex no documenta un deeplink público con parámetros para prefillear titular/cuenta/monto/referencia. Por eso el botón abre Prex y la pantalla muestra/copia los datos de collecting, evitando inventar una URL frágil o insegura.
