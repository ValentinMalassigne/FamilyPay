# Infra — docker-compose, Dockerfiles, .env

## Avant tout

Lis `PROJECT_CONTEXT.md` en entier, puis `../AGENTS.md`. Ce fichier ajoute les
contraintes spécifiques à l'infra.

## Périmètre

Tu travailles dans `infra/` uniquement. Tu gères :
- `docker-compose.yml` (services : `postgres`, `backend`, `nextjs` ; `redis`
  si besoin pour les subscriptions GraphQL).
- Les `Dockerfile` de chaque service (autonomes, buildables indépendamment
  du compose).
- `.env.example` (toutes les variables d'environnement documentées).

## Règles

- Toute config (URL DB, secrets JWT, clé API Mistral) passe par variables
  d'environnement — **jamais en dur dans le code**. Le `.env.example` liste
  toutes les variables attendues, sans valeurs réelles.
- Chaque `Dockerfile` est autonome : il build le service sans dépendre du
  `docker-compose` (utile pour un déploiement cloud futur).
- PostgreSQL doit pouvoir être remplacé par une instance managée (ex. RDS)
  sans changement de code — seule la variable de connexion change.
- Le backend expose `/health` pour compatibilité load balancer.
- Pas de dépendance à un stockage de fichiers local persistant (si besoin de
  fichiers, prévoir un stockage objet S3-compatible dès la conception).

## Variables d'environnement attendues

```
# Database
POSTGRES_HOST=
POSTGRES_PORT=5432
POSTGRES_DB=familypay
POSTGRES_USER=
POSTGRES_PASSWORD=
DATABASE_URL=postgresql://user:pass@host:5432/familypay

# Backend
JWT_SECRET=
MISTRAL_API_KEY=
BACKEND_PORT=3000

# Web (Next.js)
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:3000/graphql

# Mobile (build config, pas dans docker-compose)
GRAPHQL_URL=http://localhost:3000/graphql
```

## Commandes de dev

```bash
# Toute la stack
docker compose -f infra/docker-compose.yml up

# Back + DB seulement
docker compose -f infra/docker-compose.yml up postgres backend
```
