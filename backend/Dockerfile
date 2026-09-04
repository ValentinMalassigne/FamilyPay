# Dockerfile backend NestJS — autonome, buildable sans docker-compose (PROJECT_CONTEXT.md §9)
# Build multi-stage : stage 1 = compilation, stage 2 = runtime minimal.

# --- Stage 1 : builder ---
# node:24-alpine correspond à la version Node utilisée sur le poste de dev (Node 24 / npm 11).
# Garder la même version majeure évite une incompatibilité du package-lock.json
# entre le npm qui l'a généré (npm 11) et celui du container (npm 11 aussi).
FROM node:24-alpine AS builder
WORKDIR /app

# Copie d'abord package.json + package-lock.json pour exploiter le cache Docker.
# Si les deps ne changent pas entre deux builds, cette couche est réutilisée.
COPY package.json package-lock.json* ./
RUN npm ci

# Copie du reste du code source et compilation TypeScript → dist/
COPY . .
RUN npm run build

# --- Stage 2 : runtime ---
# Image finale plus légère : on ne garde que le code compilé (dist/) et les deps de production.
# Même version de Node que le builder (voir commentaire stage 1).
FROM node:24-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# On récupère le build du stage 1.
COPY --from=builder /app/dist ./dist

# NestJS expose le port 3000 (configurable via PORT, voir main.ts).
EXPOSE 3000

# Lance l'app compilée. En ESM ("type": "module"), le point d'entrée est dist/main.js.
CMD ["node", "dist/main.js"]
