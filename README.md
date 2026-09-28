# FamilyPay

App de gestion d'argent de poche pour ados (projet de démo, inspiré de Pixpay).

La spec complète (produit, modèle de données, schéma GraphQL, conventions) est
dans [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md).

## Structure du monorepo

```
backend/   NestJS + GraphQL + TypeORM + PostgreSQL
web/       Next.js (espace parent + page publique de don)
mobile/    Flutter (côté enfant)
infra/     docker-compose, .env.example
```

## Démarrage local

1. Copier `infra/.env.example` en `infra/.env` et remplir les secrets
   (`JWT_SECRET`, `MISTRAL_API_KEY`, identifiants PostgreSQL).
2. Lancer la stack :

   ```bash
   docker compose -f infra/docker-compose.yml up
   ```

3. Backend sur `http://localhost:3000`, web sur `http://localhost:3001`.
