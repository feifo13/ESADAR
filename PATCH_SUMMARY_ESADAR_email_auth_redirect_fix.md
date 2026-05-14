# ESADAR - Fix redirección auth desde links de emails

## Problema
Al abrir un link privado de email estando logueado, la app podía redirigir igual a `/login` porque las páginas de cuenta evaluaban `isAuthenticated` antes de que `AuthContext` terminara de validar la sesión persistida.

## Cambios
- `frontend/src/pages/AccountOrderDetailPage.jsx`
  - Espera `authLoading` antes de decidir redirigir a `/login`.
  - Muestra loader de sesión mientras se valida el token.

- `frontend/src/pages/AccountPage.jsx`
  - Espera `authLoading` antes de ejecutar el redirect a login.
  - Evita falsos negativos de sesión al entrar directo desde emails.

- `frontend/src/pages/LoginPage.jsx`
  - Si el usuario ya está autenticado y llega a `/login`, lo redirige automáticamente al destino original (`location.state.from`).
  - El login manual conserva el mismo destino de retorno.

## Validación
- `npm run build` ejecutado correctamente en frontend.
