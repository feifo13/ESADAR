# ESADAR

Proyecto organizado en dos aplicaciones:

- `frontend/` — React + Vite
- `backend/` — Node.js + Express + MySQL
- `db/` — schema y seed SQL

## Arranque rápido

### 1) Base de datos
Importa primero:
- `db/schema.sql`
- `db/seed.sql`

### 2) Backend
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

### 3) Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## Notas

- El proyecto se entrega sin `node_modules`.
- El backend expone la API usada por el frontend starter.
- El módulo de ofertas en frontend quedó preparado visualmente, pero todavía no tiene endpoints dedicados en backend.
