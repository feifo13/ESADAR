# ESADAR Lightsail / Nginx performance notes

El sandbox ya fue diagnosticado como sano a nivel backend/MySQL. La ruta publica real de catalogo es:

```txt
/api/public/articles
```

Para mantener buena performance en mobile y todos los viewports, conservar en el `server { ... }` de Nginx:

```nginx
gzip on;
gzip_vary on;
gzip_comp_level 5;
gzip_min_length 1024;
gzip_types
    text/plain
    text/css
    application/json
    application/javascript
    application/xml
    text/xml
    image/svg+xml;

location /assets/ {
    try_files $uri =404;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
}

location /uploads/ {
    proxy_pass http://127.0.0.1:4000/uploads/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    add_header Cache-Control "public, max-age=2592000" always;
}

location /api/ {
    proxy_pass http://127.0.0.1:4000/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

No aplicar cache agresivo a `/api/` porque son endpoints dinamicos.

## Checks rapidos

```powershell
curl.exe -s -D - -o NUL -H "Accept-Encoding: gzip" http://3.216.66.79/assets/index-*.js
```

Debe verse:

```txt
Cache-Control: public, max-age=31536000, immutable
Content-Encoding: gzip
```
