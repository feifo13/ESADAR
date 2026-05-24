# Diagnostico mobile iOS: scroll jitter

Esta rama agrega flags de diagnostico para aislar el temblequeo detectado en algunos iPhone 13 con Safari/Chrome. Sin `esadarDebugMobile=1` ni `localStorage.esadarDebugMobile === "1"`, la app mantiene el comportamiento normal.

## Reglas de uso

- Probar una URL por vez.
- Cerrar la pestana entre pruebas o limpiar flags persistidos antes de cambiar de hipotesis.
- Usar Android como control: los flags no deberian ser necesarios para que Android siga estable.
- No interpretar estos flags como fixes definitivos; cada uno apaga o cambia un sospechoso para medir impacto.

## URLs de prueba

Reemplazar `https://sandbox.../` por la URL real del sandbox.

1. Baseline debug:
   `https://sandbox.../?esadarDebugMobile=1`

2. Sin footer reveal mobile:
   `https://sandbox.../?esadarDebugMobile=1&disableFooterRevealMobile=1`

3. Sin listeners de `visualViewport`:
   `https://sandbox.../?esadarDebugMobile=1&disableVisualViewport=1`

4. Sin curtain cover:
   `https://sandbox.../?esadarDebugMobile=1&disableFooterCurtainCover=1`

5. Sin `content-visibility` en cards:
   `https://sandbox.../?esadarDebugMobile=1&disableCardContentVisibility=1`

6. Ticker mobile pausado:
   `https://sandbox.../?esadarDebugMobile=1&pauseTickerMobile=1`

7. Header/ticker mobile unificado:
   `https://sandbox.../?esadarDebugMobile=1&unifyMobileChrome=1`

8. Ticker mobile no fixed:
   `https://sandbox.../?esadarDebugMobile=1&disableTickerFixedMobile=1`

9. Combo fuerte de confirmacion:
   `https://sandbox.../?esadarDebugMobile=1&disableFooterRevealMobile=1&disableCardContentVisibility=1&pauseTickerMobile=1`

10. Ocultar badge debug:
    `https://sandbox.../?esadarDebugMobile=1&hideDebugBadge=1`

11. Limpiar flags persistidos:
    `https://sandbox.../?esadarDebugMobileReset=1`

## Limpieza manual

Si se persisten flags en `localStorage`, limpiar desde consola:

```js
localStorage.removeItem("esadarDebugMobileFlags");
localStorage.removeItem("esadarDebugMobile");
```

Tambien se puede abrir:

```text
?esadarDebugMobileReset=1
```

## Que aisla cada flag

- `disableFooterRevealMobile=1`: apaga el footer reveal en mobile/tablet chica, no renderiza `FooterScrollScene` en ese viewport y usa el footer normal.
- `disableVisualViewport=1`: mantiene el footer reveal, pero evita registrar listeners de `window.visualViewport`.
- `disableFooterCurtainCover=1`: mantiene el footer reveal y neutraliza la cortina/pseudo-cover sobre el header.
- `disableCardContentVisibility=1`: en mobile/tablet chica desactiva `content-visibility`, `contain-intrinsic-size` y `contain` en `.article-card`, `.featured-motion-card` y `.summary-item-card`.
- `pauseTickerMobile=1`: pausa la marquesina mobile sin ocultar el ticker.
- `unifyMobileChrome=1`: prueba header + ticker como un unico bloque fixed mobile cuando el ticker es sticky.
- `disableTickerFixedMobile=1`: deja el ticker sticky en flujo normal debajo del header mobile.

## Matriz manual sugerida

1. iPhone 13 afectado, Safari: baseline vs cada flag.
2. iPhone 13 afectado, Chrome: baseline vs cada flag.
3. Android control: baseline debug y combo fuerte.
4. Si un flag mejora, repetirlo dos veces limpiando flags entre pruebas.
5. Si solo mejora el combo fuerte, probar pares: footer + ticker, footer + cards, ticker + cards.
