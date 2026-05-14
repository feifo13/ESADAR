# ESADAR — Mobile menu, términos mobile y ancho de vistas informativas

Patch incremental sobre `ESADAR_checkout_complete_guide_terms_pdf_patch.zip`.

## Cambios incluidos

- Mobile:
  - El botón `Términos y condiciones` del footer animado queda blanco en mobile.
  - En el menú mobile, `Guía de compra` y `Términos y condiciones` quedan ubicados antes de `Salir`.

- Desktop / tablet:
  - Las cards de `/guia-de-compra` y `/terminos-y-condiciones` pasan a ocupar todo el ancho disponible del contenedor.
  - Se eliminan límites de ancho previos en hero/content cards de esas vistas.

## Archivos modificados

- `frontend/src/components/Header.jsx`
- `frontend/src/index.css`

## Validación realizada

```bash
cd frontend
npm run build
```

Resultado: OK.
