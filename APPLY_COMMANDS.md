# Aplicar patch en Lightsail / EC2

Copiar estos archivos sobre el proyecto:

```bash
frontend/src/components/Header.jsx
frontend/src/index.css
```

Luego ejecutar:

```bash
cd /var/www/esadar-sandbox/frontend
npm install
npm run build

cd ..
pm2 restart all
pm2 save
sudo nginx -t
sudo systemctl reload nginx
```
