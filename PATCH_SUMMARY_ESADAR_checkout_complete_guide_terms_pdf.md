# ESADAR — checkout completo, guía, términos y PDF al aprobar

Patch incremental construido sobre `ESADAR_article_unavailable_prex_transfer_patch.zip`.

## Cambios incluidos

### `/checkout/completa`
- Los datos de transferencia quedan dentro del mismo `section-card checkout-complete-card`.
- Se quitaron los botones de copiar por campo.
- Se quitó el botón de pago/redirección a Prex.
- Se aclara que los datos de transferencia también serán enviados por correo.
- Se conserva monto y referencia `ESADAR {número de orden}` para validación manual.

### Emails / comprobante PDF
- El mail de “Pago pendiente” ya no adjunta el comprobante PDF.
- El mail de “Pago pendiente” mantiene los datos de transferencia/cobro.
- El mail de “Orden aprobada” adjunta el comprobante PDF.
- El archivo se nombra como `comprobante-compra-{orden}.pdf`.

### Guía de compra
- Nueva vista pública `/guia-de-compra`.
- Link agregado en el menú mobile.
- Botón desktop `?` en el header hacia la guía de compra.

### Términos y condiciones
- Nueva vista pública `/terminos-y-condiciones`.
- Botón/link agregado debajo de los botones principales del footer visual.
- Link agregado también en el footer clásico por compatibilidad.

### Se conserva la iteración anterior
- Vista de artículo no disponible.
- Bloqueo de checkout cuando hay artículos agotados/no disponibles.
- Datos de collecting en checkout completo y mail de pago pendiente.

## Validación realizada

```bash
cd backend
node --check src/modules/orders/orders.mailer.js
node --check src/modules/mail/templates/approved-order.template.js
node --check src/modules/mail/templates/received-order-pending-payment.template.js

cd ../frontend
npm install --ignore-scripts
npm run build
```

Resultado: OK.
