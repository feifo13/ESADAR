# ESADAR patch: center mobile/tablet header and restore offer ribbon

Archivos incluidos:

- `frontend/src/components/ArticleCard.jsx`
- `frontend/src/index.css`

Cambios:

- Centra verticalmente los elementos del header en mobile/tablet.
- Mantiene el header fijo/sólido y sin efectos en mobile/tablet.
- Restaura la banda `OFERTA!` en cards aunque el artículo tenga una oferta aceptada.
- No vuelve a mostrar `OFERTA ACEPTADA` en la banda de las cards.
