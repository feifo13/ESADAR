# ESADAR - Links de emails por origen + redirección post-login

## Objetivo
Ajustar los links de emails para que apunten al entorno correcto según el origen de la operación:

- `https://sandbox.esadar.com.uy`
- `https://esadar.com.uy`
- `http://localhost:5173` u otro localhost con puerto

Además, cuando un usuario abre un link privado desde un email:

- Si está logueado, entra directo al destino.
- Si no está logueado, va a `/login`.
- Después del login, vuelve al destino original del email.

## Cambios principales

### Backend
- Nuevo helper `backend/src/modules/mail/mail.url-context.js`.
- Se resuelve `publicSiteUrl` desde `Origin`, `Referer` o `X-Forwarded-Host`.
- Fallback a `PUBLIC_SITE_URL`, luego `APP_ORIGIN`, luego localhost.
- Se reusó `publicSiteUrl` en templates de emails:
  - bienvenida
  - reset password
  - orden recibida / pago pendiente
  - orden aprobada
  - oferta aceptada
  - respuesta de contacto
- Se ajustaron links internos del shell del email y assets relativos.
- Se ajustaron `back_urls` de Mercado Pago para que la vuelta de pago use el entorno correcto cuando se genera la preferencia.

### Frontend
- `/cuenta/ordenes` y otras secciones privadas de cuenta ahora llevan a `/login` si no hay sesión.
- `/cuenta/ordenes/:id` ahora preserva el destino al mandar a login.
- `LoginPage` ahora vuelve al path completo original, incluyendo `search` y `hash`.

## Validación
- `npm run build` ejecutado correctamente en frontend.
- Imports principales de backend validados correctamente.

## Nota de despliegue
Para webhooks o procesos sin `Origin`/`Referer`, el fallback depende del `.env` del entorno. En sandbox conviene tener:

```env
APP_ORIGIN=https://sandbox.esadar.com.uy
PUBLIC_SITE_URL=https://sandbox.esadar.com.uy
```

En producción:

```env
APP_ORIGIN=https://esadar.com.uy
PUBLIC_SITE_URL=https://esadar.com.uy
```
