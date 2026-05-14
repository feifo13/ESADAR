# ESADAR article card ribbons refinement

Cambios incluidos:

- Quita el indicador `Oferta aceptada` de las cards de artículos.
- Quita el texto `Oferta aceptada · aplica a 1 unidad` debajo del precio en la card.
- Mantiene el precio de oferta aceptada si el artículo lo trae en el objeto.
- Evita mostrar la banda `Ofertá` cuando el usuario ya tiene una oferta aceptada para ese artículo.
- Ajusta el ancho, padding, tipografía y posición de las bandas diagonales `Ofertá` / `Agotado` para que sean más compactas en desktop, tablet y mobile.

Validación:

```bash
cd frontend
npm run build
```

Resultado: build correcto.
