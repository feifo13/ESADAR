# ESADAR footer hidden + breadcrumbs patch

## Cambios incluidos

- Se ocultó `FooterScrollScene` en las vistas públicas:
  - `/guia-de-compra`
  - `/terminos-y-condiciones`
- Se evitó también aplicar la clase `app-shell--has-footer-reveal` en esas vistas para que no quede activo ningún comportamiento visual del footer/reveal.
- Se agregaron labels específicos al breadcrumb para las rutas nuevas:
  - `Inicio > Guía de compra`
  - `Inicio > Términos y condiciones`

## Archivos modificados

- `frontend/src/components/RootLayout.jsx`
- `frontend/src/components/AppBreadcrumbs.jsx`

## Validación

- `npm run build` ejecutado correctamente en `frontend`.

## Nota

- `npm ci` informó vulnerabilidades existentes del árbol npm: 2 moderadas y 1 alta. No se modificaron dependencias ni se aplicó `npm audit fix` para evitar cambios colaterales fuera del alcance del patch.
