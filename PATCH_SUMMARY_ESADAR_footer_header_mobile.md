# ESADAR footer reveal + mobile header stabilization patch

## Archivos modificados

- `frontend/src/components/RootLayout.jsx`
- `frontend/src/components/FooterScrollScene.jsx`
- `frontend/src/index.css`

## Qué corrige

1. Evita que el footer reveal quede visible al navegar desde una posición de scroll profunda, especialmente en tablet/mobile.
2. Agrega una guarda global de navegación para ocultar el footer durante el cambio de ruta y recién liberarlo cuando el scroll ya fue estabilizado.
3. Reintenta el `scrollTo` al inicio en varios frames para cubrir navegadores móviles donde el primer scroll reset puede ser ignorado durante cambios de layout.
4. Estabiliza el cálculo del footer usando altura de escena/layout en vez de depender solo de `window.innerHeight`, que cambia en móviles cuando aparece/desaparece la barra del navegador.
5. Mitiga el temblor del header en móvil/tablet removiendo efectos caros sobre el sticky header: `backdrop-filter`, pseudo-overlays y transiciones, dejando fondo blanco sólido.
6. Usa `100svh` en mobile/tablet para el footer reveal, evitando saltos provocados por `100dvh` cuando cambia la barra del navegador.

## Validación realizada

- `npm ci --ignore-scripts`
- `npm run build`

Resultado: build correcto.

## Nota de prueba recomendada

Probar en dispositivo real, no solo en DevTools, porque el temblor visto en el video depende de la barra real del navegador móvil y de los cambios de viewport que Chrome DevTools no reproduce igual.
