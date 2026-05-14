# ESADAR remove article gallery overlay badges

Cambios:

- Quita los badges flotantes `Oferta aceptada` y `En carrito` que aparecían sobre las miniaturas/galería en la vista del artículo.
- Mantiene los avisos inferiores de la vista de artículo:
  - `Oferta aceptada` en naranja.
  - `En carrito` en azul.
- Mantiene los indicadores de cards/listado y oferta/carrito que no forman parte de la galería interna del artículo.

Validación:

```bash
cd frontend
npm run build
```

Resultado: build correcto.
