# Web — Next.js (espace parent + page publique de don)

Espace parent FamilyPay (gestion de l'argent de poche) et page publique de don
sur cagnotte. Consomme l'API GraphQL du backend (voir `PROJECT_CONTEXT.md`).

## Stack

- Next.js (App Router) + TypeScript
- Apollo Client (GraphQL : queries / mutations / subscriptions)
- Build standalone pour Docker

## Variables d'environnement

Voir `.env.example`. Copier en `.env` pour le dev local :

```bash
cp .env.example .env
```

| Variable                  | Description                          | Défaut                              |
| ------------------------- | ------------------------------------ | ----------------------------------- |
| `NEXT_PUBLIC_GRAPHQL_URL` | URL du endpoint GraphQL du backend   | `http://localhost:3000/graphql`     |

## Commandes de dev

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # build de production
npm run lint     # ESLint
```

## Docker

Le `Dockerfile` est autonome (buildable indépendamment du `docker-compose`) :

```bash
docker build -t familypay-web .
docker run -p 3001:3000 -e NEXT_PUBLIC_GRAPHQL_URL=http://localhost:3000/graphql familypay-web
```

Ou via le docker-compose à la racine du monorepo :

```bash
docker compose -f infra/docker-compose.yml up
```

## Structure

```
src/
├── app/
│   ├── layout.tsx              # Layout racine (ApolloProvider)
│   ├── page.tsx                # Accueil
│   ├── parent/page.tsx          # Espace parent (placeholder)
│   └── donate/[token]/page.tsx  # Page publique de don (placeholder)
├── lib/apollo.ts               # Client Apollo
└── components/ApolloProviderWrapper.tsx
```
