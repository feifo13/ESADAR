# ESADAR - Checklist de validación sandbox antes de producción

Usar este checklist después de hacer deploy en `https://sandbox.esadar.com.uy` y antes de promover a producción.

## 1. Configuración base

- [ ] `NODE_ENV=production` en backend sandbox si se quiere probar comportamiento real de cookies seguras.
- [ ] `TRUST_PROXY=true` detrás de Nginx/HTTPS.
- [ ] `APP_ORIGIN=https://sandbox.esadar.com.uy`.
- [ ] `PUBLIC_SITE_URL=https://sandbox.esadar.com.uy`.
- [ ] `CORS_ORIGINS=https://sandbox.esadar.com.uy`.
- [ ] `MAIL_ALLOWED_SITE_URLS=https://sandbox.esadar.com.uy,https://esadar.com.uy,http://localhost:5173`.
- [ ] `MERCADO_PAGO_ENV=test`.
- [ ] `MERCADO_PAGO_NOTIFICATION_URL=https://sandbox.esadar.com.uy/api/webhooks/mercado-pago`.

## 2. Registro, login y sesión

- [ ] Registrar un usuario nuevo desde frontend público.
- [ ] Confirmar que el usuario creado sea rol/customer, no admin.
- [ ] Verificar que llega mail de bienvenida si SMTP está activo.
- [ ] Cerrar sesión y volver a iniciar sesión.
- [ ] Validar que `/cuenta` carga sin redirigir incorrectamente a login.

## 3. Importación/exportación de artículos

- [ ] Descargar plantilla CSV simple desde admin/artículos.
- [ ] Descargar plantilla CSV completa desde admin/artículos.
- [ ] Importar CSV simple con un artículo nuevo.
- [ ] Previsualizar antes de importar y revisar warnings/errores.
- [ ] Confirmar que archivos `.xlsx` y `.xls` son rechazados en importación.
- [ ] Exportar CSV de artículos.
- [ ] Exportar XLSX de artículos.
- [ ] Exportar XLSX de estadísticas.

## 4. Checkout, stock y órdenes

- [ ] Crear artículo con stock disponible.
- [ ] Agregarlo al carrito.
- [ ] Avanzar por checkout completo.
- [ ] Confirmar que el stock queda reservado al crear orden pendiente.
- [ ] Confirmar que no permite comprar más unidades que las disponibles.
- [ ] Confirmar que el mail de orden pendiente llega con links a sandbox.
- [ ] Aprobar una orden manual o simular pago.
- [ ] Confirmar que el stock reservado pasa a vendido.
- [ ] Confirmar que las vistas admin y cuenta muestran la orden correctamente.

## 5. Mercado Pago prueba y webhook

- [ ] Crear preferencia/orden con Mercado Pago en ambiente test.
- [ ] Completar pago con usuario/tarjeta de prueba.
- [ ] Confirmar que Mercado Pago llama al webhook sandbox.
- [ ] Verificar logs backend del webhook.
- [ ] Confirmar que la orden cambia de estado una sola vez.
- [ ] Confirmar que el stock no se descuenta doble ante webhooks repetidos.
- [ ] Confirmar que llega mail de orden aprobada.

## 6. Emails y allowlist de dominios

- [ ] Disparar mail de bienvenida.
- [ ] Disparar mail de reset password.
- [ ] Disparar mail de orden pendiente.
- [ ] Disparar mail de orden aprobada.
- [ ] Disparar mail de orden enviada.
- [ ] Confirmar que todos los links apuntan solo a dominios permitidos.
- [ ] Probar request con `Origin` externo y confirmar que los emails siguen usando `PUBLIC_SITE_URL` o un dominio permitido.

## 7. Checks técnicos

Desde el servidor o entorno de CI:

```bash
cd backend && npm ci && npm audit --omit=dev && npm test
cd ../frontend && npm ci && npm audit --omit=dev && npm run check:imports && npm run build && npm run test:smoke
```

`npm run test:visual` requiere Chromium/Chrome disponible. Si corre en Linux root/Docker, usar Chromium con `--no-sandbox` ya está contemplado en el script.
