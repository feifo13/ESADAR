# ESADAR mobile footer deep-cover patch

- Ajusta el cálculo del footer reveal usando `visualViewport` cuando está disponible.
- En mobile/tablet retrasa el estado `footer-scroll-deep` hasta que el footer esté casi completamente revelado.
- Cuando el footer está en estado profundo, el footer cubre todo el viewport móvil para que no se vea una franja del “telón” al ocultarse el header.
- No cambia el comportamiento desktop.
