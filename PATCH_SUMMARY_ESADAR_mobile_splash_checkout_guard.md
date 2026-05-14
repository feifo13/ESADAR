# ESADAR mobile splash + checkout stock guard patch

Cambios incluidos:

- Mobile/tablet: los loaders con logo (`intro-splash`, `AppLoader overlay/page` durante carga de ruta y `catalog-filter-loading-splash`) quedan por encima del header fijo.
- Mobile/tablet: durante la intro inicial se oculta el header para evitar que quede visible sobre el splash.
- Checkout: si hay uno o más artículos agotados/no disponibles en el carrito, no se permite avanzar del resumen.
- Checkout: si el usuario ya estaba en otro paso y aparece un artículo no disponible, vuelve a `/checkout/resumen`.
- Checkout: el ticker de artículos no disponibles ahora avisa explícitamente que se deben eliminar los agotados para continuar.

Build validado con `npm run build`.
