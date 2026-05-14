# ESADAR checkout unavailable action compact patch

## Archivos modificados

- `frontend/src/index.css`

## Cambio

- En `/checkout/resumen`, solo en mobile/tablet, cuando un artículo está `No disponible`, se elimina la banda blanca completa de acciones debajo de la card.
- Se deja visible únicamente el botón de quitar/eliminar.
- El cambio queda limitado a `.summary-item-card--unavailable`, por lo que no afecta artículos disponibles ni otros controles de cantidad.

## Validación

```bash
cd frontend
npm run build
```

Resultado: build correcto.
