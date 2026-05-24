# Diagnostico de temblequeo mobile

Esta rama agrega flags de diagnostico para aislar posibles causas del micro-salto visual en iPhone. Sin `esadarDebugMobile=1` en la URL o en `localStorage`, la app debe comportarse igual que la rama base.

## URLs sandbox

Baseline:
https://sandbox.esadar.com.uy/?esadarDebugMobile=1

Reset:
https://sandbox.esadar.com.uy/?esadarDebugMobileReset=1

Sin footer reveal:
https://sandbox.esadar.com.uy/?esadarDebugMobile=1&disableFooterRevealMobile=1

Sin visualViewport:
https://sandbox.esadar.com.uy/?esadarDebugMobile=1&disableVisualViewport=1

Sin curtain cover:
https://sandbox.esadar.com.uy/?esadarDebugMobile=1&disableFooterCurtainCover=1

Sin content-visibility:
https://sandbox.esadar.com.uy/?esadarDebugMobile=1&disableCardContentVisibility=1

Ticker pausado:
https://sandbox.esadar.com.uy/?esadarDebugMobile=1&pauseTickerMobile=1

Ticker no fixed:
https://sandbox.esadar.com.uy/?esadarDebugMobile=1&disableTickerFixedMobile=1

Header/ticker unificado:
https://sandbox.esadar.com.uy/?esadarDebugMobile=1&unifyMobileChrome=1

Combo fuerte:
https://sandbox.esadar.com.uy/?esadarDebugMobile=1&disableFooterRevealMobile=1&disableCardContentVisibility=1&pauseTickerMobile=1

## Limpieza

Abrir esta URL limpia el modo debug y los flags persistidos:
https://sandbox.esadar.com.uy/?esadarDebugMobileReset=1

Tambien se limpian manualmente con:

```js
localStorage.removeItem("esadarDebugMobileFlags");
localStorage.removeItem("esadarDebugMobile");
```

## Registro de resultados

iPhone modelo:
iOS:
Navegador:

Baseline:
Sin footer reveal:
Sin visualViewport:
Sin curtain cover:
Sin content-visibility:
Ticker pausado:
Ticker no fixed:
Header/ticker unificado:
Combo fuerte:

Observacion:
Donde tiembla mas: Home / catalogo / footer / al abrir menu / al scrollear rapido / al scrollear lento
