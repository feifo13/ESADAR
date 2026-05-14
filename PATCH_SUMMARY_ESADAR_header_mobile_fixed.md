# ESADAR header mobile fixed patch

Patch incremental sobre `ESADAR_footer_header_mobile_patch.zip`.

## Objetivo

Mitigar el temblequeo del header en celulares/tablets reales, especialmente en navegadores móviles donde la barra superior/inferior del navegador modifica el viewport durante el scroll.

## Cambio aplicado

Archivo modificado:

- `frontend/src/index.css`

Se agrega una regla final para `@media (max-width: 960px)` que:

- Cambia el header mobile/tablet de `position: sticky` a `position: fixed`.
- Reserva el espacio del header agregando `margin-top: var(--header-height)` al `page-shell`.
- Fuerza header blanco sólido en mobile/tablet.
- Elimina `backdrop-filter`, transparencias, transformaciones, transiciones y animaciones del header en mobile/tablet.
- Mantiene intacto el comportamiento desktop.
- Mantiene la lógica actual de ocultamiento del footer que ya estaba funcionando.

## Validación

Ejecutado:

```bash
cd frontend
npm run build
```

Resultado: build correcto.
