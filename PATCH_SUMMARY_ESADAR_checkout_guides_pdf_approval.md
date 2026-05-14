# ESADAR — checkout, guías, términos y PDF al aprobar

Patch incremental construido sobre `ESADAR_article_unavailable_prex_transfer_patch.zip`.

## Cambios incluidos

### Checkout completo
- El bloque de transferencia ya no queda como card separada.
- Los datos de pago quedan dentro de `section-card checkout-complete-card`.
- Se quitaron los botones de copiar datos.
- Se quitó el botón de redirección/apertura de Prex.
- Se aclara que los datos de transferencia también serán enviados por correo.
- Se conserva monto y referencia de orden para validar el pago manualmente.

### Emails y comprobante PDF
- El comprobante PDF deja de adjuntarse en el mail de “Pago pendiente”.
- El comprobante PDF se adjunta en el mail de “Orden aprobada”.
- El archivo se nombra como `comprobante-compra-{orden}.pdf`.
- El mail de pago pendiente ahora informa que el comprobante se enviará cuando la orden sea aprobada.

### Guía de compra
- Nueva vista pública: `/guia-de-compra`.
- Agregada al menú mobile.
- Agregado botón desktop con signo `?` en el header.

### Términos y condiciones
- Nueva vista pública: `/terminos-y-condiciones`.
- Agregado botón/link en el footer visual debajo de los botones existentes.
- Agregado link también en el footer clásico por compatibilidad.

### Incluye también los archivos del patch anterior
Para evitar pisar o perder la iteración previa, este ZIP mantiene los archivos relacionados con:
- vista de artículo no disponible,
- bloqueo de checkout por artículos agotados/no disponibles,
- datos de collecting en checkout completo.

## Validaciones realizadas

```bash
cd frontend
npm install --ignore-scripts
npm run build
```

Resultado: build correcto.

```bash
cd backend
npm install --ignore-scripts
node --check src/modules/orders/orders.mailer.js
node --check src/modules/mail/templates/approved-order.template.js
node --check src/modules/mail/templates/received-order-pending-payment.template.js
```

Resultado: checks correctos.
