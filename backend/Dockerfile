# Dockerfile backend NestJS — autonome, buildable sans docker-compose (PROJECT_CONTEXT.md §9)
# Build multi-stage : stage 1 = compilation, stage 2 = runtime minimal.

# --- Stage 1 : builder ---
# On utilise node:22-alpine (LTS) pour compiler le projet TypeScript.
FROM node:22-alpine AS builder
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
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# On récupère le build du stage 1.
COPY --from=builder /app/dist ./dist

# NestJS expose le port 3000 (configurable via PORT, voir main.ts).
EXPOSE 3000

# Lance l'app compilée. En ESM ("type": "module"), le point d'entrée est dist/main.js.
CMD ["node", "dist/main.js"]
