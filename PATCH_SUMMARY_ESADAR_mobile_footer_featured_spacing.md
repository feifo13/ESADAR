# ESADAR mobile footer/header + featured spacing patch

Cambios incluidos:

- Mobile/tablet: el header permanece fijo y sólido durante navegación normal, pero se oculta cuando el footer reveal llega a estado profundo (`app-shell--footer-scroll-deep`).
- No afecta desktop.
- Mobile: limpia el espacio inferior del carrusel de destacados eliminando padding/margen inferior del rail y ajustando altura de las cards destacadas.
- Mantiene el build de Vite válido.

Validación:

```bash
cd frontend
npm run build
```

Resultado: build correcto.
