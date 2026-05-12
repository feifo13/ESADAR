# ESADAR frontend env/same-origin patch

Aplicar en tu repo local:

```bash
cd frontend

# Copiar/pegar los archivos de este patch respetando las rutas.

# IMPORTANTE: sacar el env local del repo si estaba versionado.
git rm --cached .env 2>/dev/null || true
rm -f .env
cp .env.example .env.local

# Revisar cambios
cd ..
git status
npm --prefix frontend ci
npm --prefix frontend run build
```

Luego commit/push:

```bash
git add frontend/vite.config.js \
  frontend/src/lib/api.js \
  frontend/src/lib/seo.js \
  frontend/src/contexts/SiteSeoContext.jsx \
  frontend/.gitignore \
  frontend/.env.example \
  frontend/README.md

git add -u frontend/.env

git commit -m "Configure frontend same-origin API per environment"
git push origin staging/sandbox
```

En Lightsail:

```bash
cd /var/www/esadar-sandbox
git checkout staging/sandbox
git pull --ff-only origin staging/sandbox
cd frontend
rm -f .env .env.local .env.production.local
npm ci
rm -rf dist
npm run build
sudo nginx -t
sudo systemctl reload nginx
grep -R "localhost:4000" dist -n | head -n 20
grep -R "localhost:5173" dist -n | head -n 20
```

Ambos grep deberían no devolver resultados.
