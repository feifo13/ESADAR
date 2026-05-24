# Arquitectura CSS ESADAR

El punto de entrada es `frontend/src/index.css`, que importa `styles/index.css`. No importar archivos CSS sueltos desde componentes salvo una necesidad muy puntual y documentada.

## Orden de imports

1. `00-*`: tokens, variables y base de tema.
2. `01-*` a `10-*`: reset, base, layout, forms, botones, utilidades y header.
3. `20-*`, `30-*`, `40-*`, `50-*`: dominios de producto, admin, cuenta y checkout.
4. `60-*` a `62-*`: responsive general.
5. `70-*` a `84-*`: overrides historicos conservados en orden de cascada para no cambiar la UI.
6. `rails.css` y `feedback.css`: componentes globales pequenos que antes se importaban desde `main.jsx`.

## Donde agregar estilos

- Base global: `01-reset-base.css` o `02-layout.css`.
- Componentes compartidos: el archivo de dominio mas cercano (`04-buttons-utilities.css`, `09-modals-footer-core.css`, `20-catalog-article-core.css`, etc.).
- Paginas publicas: archivos `20-*`/`21-*`/`23-*`/`24-*`.
- Admin: archivos `30-*`/`31-*`/`32-*`/`33-*`.
- Cuenta: `40-account-mobile.css` o el modulo de ordenes si corresponde.
- Checkout: archivos `50-*`/`51-*`/`52-*`.
- Responsive: preferir el modulo existente mas cercano; si es un override transversal, usar `60-*`/`61-*`/`62-*`.

## Breakpoints en uso

La app conserva los breakpoints existentes: `560`, `640`, `720`, `767`, `780`, `820`, `900`, `960`, `980`, `1024`, `1080`, `1180`, `1200`, `1240`, `1280` y reglas `min-width` puntuales. No normalizar breakpoints sin smoke visual en mobile, tablet y desktop.

## Reglas de mantenimiento

- Mantener la cascada: tokens -> base -> layout -> componentes -> dominios -> responsive -> overrides.
- Evitar duplicar selectores; buscar antes con `rg "selector" frontend/src/styles frontend/src/index.css`.
- No usar `!important` salvo para overrides historicos o conflictos visuales confirmados.
- No eliminar clases si pueden venir de strings dinamicos como `status-${status}`, `app-loader--${variant}`, `app-snackbar--${type}`, `mobile-status-band--${type}` o variantes admin.
- Zonas sensibles: header, ticker, footer reveal, product cards, admin tables, checkout, mobile cards y modales. Cualquier cambio ahi necesita revision visual.
