# Configuracion de Mercado Pago en ESADAR

## Objetivo

La app usa Checkout Pro para generar un link de pago por orden cuando el cliente elige Mercado Pago. Cuando el link esta disponible, se muestra en el checkout completo y se envia en el mail de orden recibida / pago pendiente. Actualmente el flujo no genera QR y el mail pendiente no adjunta PDF.

El webhook y la reconciliacion del retorno sincronizan el estado autoritativo: ESADAR consulta el pago por API desde el backend, registra o actualiza el pago y, cuando corresponde, marca la orden como pagada y aprueba la orden vendiendo el stock reservado. El PDF de comprobante de compra se adjunta recien al mail de orden aprobada. No se solicita al cliente enviar un comprobante manual.

## Base de datos

Las migraciones historicas ya fueron consolidadas/aplicadas. Para preparar sandbox usa solamente los scripts activos de `db/scripts/`:

- `01_from_scratch_superadmin_seed.sql` para crear una base nueva.
- `02_vaciado_operativo_sandbox.sql` como único vaciado operativo habitual.

El vaciado operativo elimina pagos, preferencias, webhooks y demás evidencia transaccional anterior, pero preserva exactamente `company_collecting_settings` y toda la configuración vigente de Mercado Pago. Consulta `docs/OPERATIONAL_RESET.md` para el contrato y el comando seguro.

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
   - boton `Pagar con Mercado Pago` cuando el link este disponible,
   - link directo,
   - detalle de la orden,
   - sin QR,
   - sin PDF mientras el pago siga pendiente.

   Cuando el pago sea confirmado y la orden quede aprobada, el email de aprobacion adjunta el comprobante de compra en PDF.

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
