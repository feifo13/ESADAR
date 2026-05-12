# ESADAR performance optimization pass

Branch sugerido: `perf/mobile-all-viewports-frontend-optimization`.

## Cambios aplicados

- Se agrego cache publico con TTL y deduplicacion de requests GET en `frontend/src/lib/api.js`.
- Se agrego `runWhenIdle` en `frontend/src/lib/performance.js` para diferir requests no criticas.
- `LookupsContext` y `SiteSeoContext` usan cache de sesion/memoria para evitar revalidaciones repetidas de datos poco cambiantes.
- `WishlistContext` ya no dispara el fetch publico de wishlist automaticamente para usuarios sin token. La wishlist de invitado se hidrata al entrar a `/cuenta/guardados`.
- `HomePage` difiere destacados y ofertas aceptadas con `requestIdleCallback`/fallback, y cachea el catalogo publico por TTL corto.
- `HomePage` prioriza solo la primera imagen del hero; las restantes quedan lazy/low priority.
- `SmartImage` agrega `decoding="async"` por defecto y mantiene lazy loading por defecto.
- Cards y galerias priorizan thumbs/imagenes chicas antes que imagenes grandes cuando existen y agregan `sizes`.
- Se removio la importacion pesada de todas las opciones de theme desde `ThemeContext`; queda fijo `Sharp Lab Light 01` + `Neo Grotesk` sin cargar el mapa completo de temas en JS.
- Se agregaron safeguards CSS de `content-visibility`, `contain` y `prefers-reduced-motion` sin tocar la estetica base.
- Se documento la configuracion Nginx recomendada para gzip/cache en `docs/LIGHTSAIL_NGINX_PERFORMANCE.md`.

## Validacion ejecutada

```bash
cd frontend
npm run build
npm run check:imports
ESADAR_SMOKE_BASE_URL=http://127.0.0.1:5173 npm run test:smoke
```

Resultado:

- Build OK.
- Unused import check OK.
- Smoke routes OK con `127.0.0.1`.

Nota: `npm run test:smoke` contra `localhost` dio timeout en este container aunque Vite quedo listo; con `127.0.0.1` paso correctamente.

## Validacion recomendada en sandbox

- Abrir DevTools > Network > Fast 4G.
- Confirmar que sin token no se disparen automaticamente `/me`, wishlist, cart ni accepted offers.
- Confirmar que `/api/public/lookups` y `/api/public/seo/site` no se repitan al navegar.
- Confirmar que cards fuera del viewport no carguen imagenes de inmediato.
- Confirmar en Lighthouse Mobile que bajan requests iniciales/revalidaciones.
- Probar compra completa: catalogo, articulo, carrito, checkout, ofertas, wishlist, login y admin.
