# FamilyPay — Instructions globales pour l'agent

## Source de vérité

**Avant toute feature, lis `PROJECT_CONTEXT.md` en entier.** C'est la spec
produit, le modèle de données, le schéma GraphQL et les conventions. Tout ce
que tu écris doit s'y conformer. En cas de divergence entre ce fichier et
`PROJECT_CONTEXT.md`, c'est `PROJECT_CONTEXT.md` qui gagne — corrige alors cet
AGENTS.md pour rester cohérent.

## Structure du monorepo

```
FamilyPay/
├── PROJECT_CONTEXT.md   # spec unique (ne pas modifier sans raison)
├── backend/             # NestJS + GraphQL + TypeORM + PostgreSQL
├── web/                 # Next.js (espace parent + page publique de don)
├── mobile/              # Flutter (côté enfant)
├── infra/               # docker-compose, .env.example, Dockerfiles partagés
└── AGENTS.md            # ce fichier
```

Chaque sous-dossier a son propre `AGENTS.md` avec les contraintes spécifiques
à sa stack. Ces fichiers sont chargés automatiquement quand on travaille dans
le sous-dossier — respecte-les.

## Workflow Git (voir PROJECT_CONTEXT.md §11)

- `main` est toujours stable/démontrable. **Jamais de commit direct sur `main`.**
- Une branche par feature, préfixée : `feat/...`, `fix/...`, `chore/...`,
  `docs/...` (ex. `feat/backend-mission-flow`).
- Chaque branche est mergée dans `main` via une Pull Request (même en solo —
  historique de revue propre, bonne pratique en entretien).
- Commits atomiques en Conventional Commits :
  `type(scope): description au présent, minuscule, sans point final`
  - Types : `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `style`
  - Scopes : `backend`, `web`, `mobile`, `infra`
  - Un commit = un changement logique cohérent ; pas de commit fourre-tout,
    pas de micro-commits qui cassent la compilation entre eux.
  - Corps de commit recommandé pour les changements non triviaux (le
    "pourquoi", pas le "quoi").

## Commentaires obligatoires (voir PROJECT_CONTEXT.md §10)

Le propriétaire du projet est **débutant sur NestJS, GraphQL et PostgreSQL**.
Toute IA travaillant sur le projet doit **commenter systématiquement** le code
touchant à ces trois technologies :

- **NestJS** : expliquer le rôle de chaque décorateur non trivial
  (`@Injectable`, `@Resolver`, `@UseGuards`, `@Cron`...), pourquoi un
  module/provider est structuré ainsi, et le flux d'injection de dépendances
  quand il n'est pas évident.
- **GraphQL** : commenter les resolvers (ce que fait chaque
  query/mutation/subscription), pourquoi un guard ou un input type est
  utilisé, et comment fonctionne le pub/sub là où c'est mis en place.
- **PostgreSQL / TypeORM** : commenter les entités (relations, contraintes,
  index), les migrations, et toute requête un peu complexe (jointures,
  agrégations).
- **Flutter / Next.js** : pas besoin de ce niveau de détail — commentaires
  normaux suffice. Concentre les commentaires sur les technos non maîtrisées.

Objectif : pouvoir répondre en entretien à "explique-moi ce bout de code" sans
hésitation, même sur une partie générée par l'IA.

## Règles de sécurité (voir PROJECT_CONTEXT.md §8)

- JWT séparés parent/enfant, `role` dans le payload.
- Guards NestJS par rôle sur les resolvers.
- Mot de passe hashé (bcrypt/argon2).
- La mutation `contributeToPotPublic` (don public sur cagnotte) est la **seule**
  route non authentifiée — à isoler dans un guard dédié pour ne pas fragiliser
  le reste de l'API.

## Déploiement & portabilité (voir PROJECT_CONTEXT.md §9)

- Tout tourne en local via `docker-compose` pendant le dev.
- Chaque service (`backend`, `nextjs`) a un `Dockerfile` autonome, buildable
  indépendamment du compose.
- Toute config (URL DB, secrets JWT, clé API Mistral) passe par variables
  d'environnement — **jamais en dur dans le code**.
- Le backend expose `/health` pour un load balancer / orchestrateur cloud.
- PostgreSQL remplaçable par une instance managée sans changement de code.

## Tests

Pas de tests automatisés prévus cette itération (priorité au périmètre
fonctionnel, voir §5 "hors scope"). Si la décision change, le dire ici.

## Commandes de dev

```bash
# Lancer toute la stack locale
docker compose -f infra/docker-compose.yml up

# Back uniquement
docker compose -f infra/docker-compose.yml up postgres backend
```

Les commandes spécifiques (install, lint, build) sont documentées dans le
AGENTS.md de chaque sous-dossier quand elles existent.
