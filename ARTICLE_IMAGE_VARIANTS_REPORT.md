# ESADAR — Optimización de imágenes de artículos

## Diagnóstico

Después de corregir Nginx para servir JS/CSS con gzip y `Cache-Control: immutable`, la carga mobile seguía lenta porque la home descargaba imágenes originales `front.jpg` muy pesadas desde cards/listados.

En Fast 4G se observaron varias imágenes entre ~779 KB y ~4.7 MB, con un total inicial cercano a 14 MB. El cuello de botella ya no era backend, MySQL, Nginx ni bundle JS/CSS, sino imágenes originales usadas en contextos de card/home.

## Cambios aplicados

### Backend

- Se reforzó `backend/src/modules/articles/article-image-processing.js` para generar variantes WebP con tamaños/qualities definidos:
  - `thumb`: 320px, WebP quality 76.
  - `card`: 640px, WebP quality 80.
  - `detail`: 1200px, WebP quality 84.
  - `zoom`: 1800px, WebP quality 86.
- Se mantiene el original para admin, exportación, zoom o futuras necesidades.
- Se mejoró la resolución de paths para preservar subcarpetas dentro de `UPLOAD_DIR=uploads`, por ejemplo:
  - `/uploads/articles/art-0001/front.jpg`
  - `/uploads/articles/art-0001/front-thumb.webp`
  - `/uploads/articles/art-0001/front-card.webp`
  - `/uploads/articles/art-0001/front-detail.webp`
- Las imágenes nuevas subidas desde admin siguen generando variantes automáticamente.
- Las imágenes referenciadas por importación/sync también intentan generar variantes si existen dentro de `/uploads`.
- La API pública de artículos ahora expone aliases compatibles y explícitos:
  - `imageThumbUrl`
  - `imageCardUrl`
  - `imageDetailUrl`
  - `imageOriginalUrl`
  - además de mantener `primaryImage`, `primaryImageThumb`, `primaryImageCard`, `primaryImageDetail`, `primaryImageOriginal`.

### Script de backfill

Se agregó:

```bash
backend/scripts/backfill-article-image-variants.mjs
```

Y scripts npm:

```bash
npm run images:backfill:dry-run
npm run images:backfill
```

Este backfill:

- Recorre `article_images`.
- Detecta imágenes que no tienen variantes optimizadas o que todavía apuntan al original.
- Genera WebP al lado del archivo original.
- Actualiza columnas de variantes en DB.
- No borra originales.
- Respeta `UPLOAD_DIR=uploads`.
- Soporta `--dry-run`, `--force` y `--limit=N`.

### Frontend

- Las cards y destacados ahora prefieren imágenes optimizadas:
  - thumb/card para cards/home/catálogo/destacados.
  - detail para páginas de detalle/galerías.
- `ArticleCard` y `FeaturedMotionCards` usan `srcSet` + `sizes` para que mobile no descargue el original pesado.
- Wishlist/cart local usan la imagen optimizada cuando existe.

## Cómo correr backfill en Lightsail sandbox

Desde el backend:

```bash
cd /var/www/esadar-sandbox/backend
```

Primero prueba segura:

```bash
npm run images:backfill:dry-run
```

Si se ve correcto:

```bash
npm run images:backfill
```

Para probar pocas imágenes:

```bash
node scripts/backfill-article-image-variants.mjs --limit=5
```

Para regenerar todo aunque ya tenga variantes:

```bash
node scripts/backfill-article-image-variants.mjs --force
```

## Cómo validar

1. Confirmar que se generaron archivos `.webp`:

```bash
find uploads/articles -name "*-card.webp" -o -name "*-thumb.webp" | head
```

2. Confirmar tamaños:

```bash
find uploads/articles -name "*.webp" -exec du -h {} \; | sort -hr | head -30
```

3. Confirmar API pública:

```bash
curl -s http://127.0.0.1:4000/api/public/articles | grep -o "imageCardUrl" | head
```

4. Confirmar DevTools:

- Mobile viewport.
- Network → Fast 4G.
- Disable cache ON para primera medición.
- Recargar home.
- Las cards deberían cargar `.webp` optimizados, no múltiples `front.jpg` de megabytes.

Objetivo inicial: bajar la transferencia inicial de imágenes de ~14 MB a menos de 2 MB, idealmente menos de 1 MB para el contenido visible inicial.
