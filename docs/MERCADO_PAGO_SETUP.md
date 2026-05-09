# Configuracion de Mercado Pago en ESADAR

## Objetivo

La app usa Checkout Pro para generar un link de pago por orden cuando el cliente elige Mercado Pago. Ese link se envia en el mail de orden recibida / pago pendiente, junto con un QR que apunta al mismo pago y el PDF de la orden adjunto.

## Configuracion recomendada para pruebas

1. Corre la migracion nueva:

   ```sql
   SOURCE db/migrations/2026-05-09-002-configure-mercado-pago.sql;
   ```

2. Entra como admin a `/admin/collecting`.

3. En la seccion Mercado Pago:
   - Habilitado: activado.
   - Ambiente: `Prueba`.
   - Public key: pega la Public Key de credenciales de prueba.
   - Access token: pega el Access Token completo de credenciales de prueba.
   - Usuario / Collector ID: pega el User ID de credenciales de prueba.
   - Link de pago fallback: opcional. Solo se usa si falla la preferencia dinamica.
   - URL de notificacion / webhook: opcional por ahora.

4. Guarda la configuracion.

5. Crea una orden usando metodo de pago Mercado Pago. El email deberia incluir:
   - boton `Pagar ahora con Mercado Pago`,
   - link directo,
   - QR,
   - PDF de la orden.

## Produccion

Para pasar a produccion:

1. Cambia el ambiente a `Produccion`.
2. Reemplaza Public Key, Access Token y User ID por credenciales productivas.
3. Asegurate de que `PUBLIC_SITE_URL` apunte al dominio real con HTTPS.
4. Configura `MERCADO_PAGO_NOTIFICATION_URL` o el campo webhook en `/admin/collecting` cuando se implemente conciliacion automatica.

## Seguridad

- El Access Token no se muestra al volver a cargar la pantalla admin.
- Si el campo Access Token queda vacio al guardar, se conserva el token anterior.
- No commitees credenciales reales en `.env`, seeds o migraciones.
