# ESADAR - Mail template orden enviada

## Cambios

- Se agregó `backend/src/modules/mail/templates/shipped-order.template.js`.
- Se agregó `sendShippedOrderEmail` en `backend/src/modules/orders/orders.mailer.js`.
- Se conectó el envío automático del email al flujo `shipOrder` cuando una orden aprobada se marca como `SHIPPED`.
- El link del botón `Ver mi orden` usa la misma resolución de origen ya implementada para sandbox, producción y localhost.
- Si el usuario no está logueado, el frontend conserva el redirect al login y luego vuelve al detalle de la orden.

## Validaciones

- `node --check` sobre archivos backend modificados.
- Render de prueba del template con URL sandbox.
- `npm run build` en frontend.

## Nota

El cambio no agrega migraciones ni modifica base de datos.
