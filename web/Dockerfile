# Dockerfile web Next.js — autonome, buildable sans docker-compose (PROJECT_CONTEXT.md §9)
# Build multi-stage : stage 1 = build (next build), stage 2 = runtime minimal.

# --- Stage 1 : builder ---
# node:24-alpine : même version majeure de Node que le backend (Node 24 / npm 11)
# pour garder la compatibilité du package-lock.json entre le npm qui l'a généré
# et celui du container.
FROM node:24-alpine AS builder
WORKDIR /app

# Copie d'abord package.json + package-lock.json pour exploiter le cache Docker.
COPY package.json package-lock.json* ./
RUN npm ci

# Copie du reste du code source et build Next.js.
# output: "standalone" dans next.config.ts → Next génère .next/standalone,
# un serveur Node autonome (sans node_modules complet au runtime).
COPY . .
RUN npm run build

# --- Stage 2 : runtime ---
# Image finale plus légère : on ne garde que le serveur standalone + les assets statiques.
# Même version de Node que le builder (voir commentaire stage 1).
FROM node:24-alpine
WORKDIR /app

ENV NODE_ENV=production

# Serveur standalone généré par Next.js (output: "standalone").
COPY --from=builder /app/.next/standalone ./
# Assets statiques (.next/static) et dossier public : servis par le serveur standalone.
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Next.js (standalone) expose le port 3000.
EXPOSE 3000

# Lance le serveur Next.js autonome.
CMD ["node", "server.js"]
