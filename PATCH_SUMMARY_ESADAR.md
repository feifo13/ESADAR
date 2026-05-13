# ESADAR auth/me anonymous session check patch

Iteración sobre `ESADAR_intro_cart_iteracion_2026-05-12.zip`.

## Problema
Al entrar a `/` sin estar logueado, el frontend ejecutaba `/api/auth/me` para intentar restaurar sesión. Como esa ruta exigía autenticación, el backend respondía `401 Missing access token`. Luego `apiFetch` lo reportaba al módulo de client logs, generando entradas `[client-log]` aunque era un caso normal para visitantes anónimos.

## Cambio aplicado
- `GET /api/auth/me` ahora usa `optionalAuth` en vez de `requireAuth`.
- Si no hay cookie/token válido, responde `200 { ok: true, user: null }`.
- Si hay sesión válida, responde igual que antes con el usuario.
- El frontend limpia token local stale cuando recibe `user: null`.

## Seguridad
No se expone información privada sin sesión: el endpoint solo devuelve `user: null` para visitantes anónimos o tokens inválidos. Las rutas realmente protegidas siguen usando `requireAuth`.
