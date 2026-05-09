# Configuracion de Mercado Pago en ESADAR

## Objetivo

La app usa Checkout Pro para generar un link de pago por orden cuando el cliente elige Mercado Pago. Ese link se envia en el mail de orden recibida / pago pendiente, junto con un QR que apunta al mismo pago y el PDF de la orden adjunto.

Desde esta version tambien existe un webhook para sincronizar el pago automaticamente: cuando Mercado Pago notifica un pago aprobado, ESADAR consulta el pago por API, registra/actualiza el pago, marca la orden como pagada y aprueba la orden vendiendo el stock reservado.

## Migraciones necesarias

Ejecuta estas migraciones si todavia no las corriste:

```sql
SOURCE db/migrations/2026-05-09-002-configure-mercado-pago.sql;
SOURCE db/migrations/2026-05-09-003-mercado-pago-webhooks.sql;
```

La migracion `002` fue corregida para MySQL sin `ADD COLUMN IF NOT EXISTS`.

## Configuracion recomendada para pruebas

1. Entra como admin a `/admin/collecting`.
2. En la seccion Mercado Pago:
   - Habilitado: activado.
   - Ambiente: `Prueba`.
   - Public key: pega la Public Key de credenciales de prueba.
   - Access token: pega el Access Token completo de credenciales de prueba.
   - Usuario / Collector ID: pega el User ID de credenciales de prueba.
   - Link de pago fallback: opcional. Solo se usa si falla la preferencia dinamica.
   - URL de notificacion / webhook: `https://TU-DOMINIO.com/api/webhooks/mercado-pago?source_news=webhooks`.
   - Firma secreta del webhook: pega la firma generada en el panel de Mercado Pago > Webhooks.
3. Guarda la configuracion.
4. Crea una orden usando metodo de pago Mercado Pago. El email deberia incluir:
   - boton `Pagar ahora con Mercado Pago`,
   - link directo,
   - QR,
   - PDF de la orden.

## Configuracion en Mercado Pago

En Mercado Pago Developers > Tu aplicacion > Webhooks:

1. Configura URL de prueba y/o produccion apuntando a:

   ```text
   https://TU-DOMINIO.com/api/webhooks/mercado-pago?source_news=webhooks
   ```

2. Activa el evento `Payments` / topico `payment`.
3. Guarda y copia la firma secreta generada.
4. Pega esa firma en `/admin/collecting` o define `MERCADO_PAGO_WEBHOOK_SECRET` en `.env`.
5. Usa el simulador de Webhooks del panel para confirmar que ESADAR responde `200`.

## Produccion

Para pasar a produccion:

1. Cambia el ambiente a `Produccion`.
2. Reemplaza Public Key, Access Token y User ID por credenciales productivas.
3. Asegurate de que `PUBLIC_SITE_URL` apunte al dominio real con HTTPS.
4. Asegurate de que la URL de webhook use HTTPS publico.
5. Configura la URL productiva en Mercado Pago Developers.
6. Ejecuta una compra real pequena para validar el flujo completo.

## Seguridad

- El Access Token no se muestra al volver a cargar la pantalla admin.
- La firma secreta del webhook tampoco se muestra al volver a cargar la pantalla admin.
- Si esos campos quedan vacios al guardar, se conservan los valores anteriores.
- El webhook valida `x-signature` cuando hay firma secreta configurada.
- No commitees credenciales reales en `.env`, seeds o migraciones.

## Flujo automatico post-pago

Cuando llega un webhook `payment`:

1. ESADAR valida la firma si hay firma configurada.
2. Guarda la notificacion en `mercado_pago_webhook_events`.
3. Consulta `GET /v1/payments/{id}` en Mercado Pago.
4. Busca la orden por `metadata.order_id` o `external_reference`.
5. Registra/actualiza el pago en `payments`.
6. Si el pago esta aprobado y el monto coincide con el total:
   - `payment_status` pasa a `PAID`.
   - `order_status` pasa a `APPROVED` si estaba `RESERVED` o `PENDING`.
   - El stock reservado pasa a vendido.
   - Se envia el mail de orden aprobada.
7. Si el monto no coincide, no aprueba la orden y deja auditoria para revision manual.
