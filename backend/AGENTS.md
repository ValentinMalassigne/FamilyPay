# Backend — NestJS + GraphQL + TypeORM + PostgreSQL

## Avant tout

Lis `PROJECT_CONTEXT.md` en entier, puis `../AGENTS.md`. Ce fichier ajoute les
contraintes spécifiques au backend.

## Périmètre

Tu travailles dans `backend/` uniquement. Le contrat partagé avec web et
mobile est le **schéma GraphQL** (PROJECT_CONTEXT.md §6) et le
`docker-compose` (`../infra/`). Toute évolution du schéma GraphQL passe par
une PR backend d'abord — les fronts le consomment, ne le modifient pas.

## Stack

- NestJS + GraphQL (Apollo, code-first avec `@nestjs/apollo`)
- TypeORM + PostgreSQL
- `@nestjs/schedule` pour le cron des allowances
- bcrypt/argon2 pour le hash des mots de passe
- JWT avec `role` dans le payload (PARENT | CHILD)

## Commentaires obligatoires

Débutant sur NestJS / GraphQL / PostgreSQL → commenter systématiquement :

- **Décorateurs NestJS** : `@Injectable`, `@Resolver`, `@UseGuards`, `@Cron`,
  `@Module`, etc. — expliquer le rôle et pourquoi on l'utilise ici.
- **Resolvers GraphQL** : ce que fait chaque query/mutation/subscription, le
  guard appliqué, le type d'entrée/sortie.
- **Subscriptions** : expliquer le mécanisme pub/sub (`@Subscription`,
  `PubSub`), comment l'événement est publié côté service et consommé côté
  client.
- **Entités TypeORM** : relations (`@OneToMany`, `@ManyToOne`...), contraintes
  (unique, not null), index, et pourquoi.
- **Migrations / requêtes** : toute requête un peu complexe (jointure,
  agrégation) est commentée pour expliquer ce qu'elle fait et pourquoi.

## Règles métier à respecter scrupuleusement

- **Solde** : `ChildAccount.balance` est stocké et mis à jour à chaque
  transaction, jamais recalculé à la volée. Le solde ne peut **jamais** passer
  en négatif — tout débit qui ferait passer le solde sous 0 est rejeté
  (`BadRequestException`) avant la mise à jour.
- **Blocage de carte** : `blockedBy` détermine la priorité. Si `PARENT`,
  seul un parent peut débloquer. Si `CHILD` ou null, l'enfant peut
  bloquer/débloquer. Un parent peut toujours bloquer/débloquer.
- **Cagnotte (Pot)** : `withdrawalPolicy` (`ANYTIME` | `WHEN_FULL` |
  `PARENT_ONLY`). L'enfant suit la policy ; un parent peut toujours retirer,
  quelle que soit la policy. Le guard de la mutation de retrait doit
  distinguer l'appelant.
- **Contribution publique** : montant plafonné à `targetAmount -
  currentAmount` (pas de dépassement de l'objectif). C'est la seule mutation
  sans JWT — à isoler dans un guard dédié, exclue du guard d'auth global.
- **Missions** : flux `PENDING` → `DONE_BY_CHILD` → `VALIDATED` (crée une
  `Transaction` `MISSION_REWARD`) ou `REJECTED`.
- **Allowance cron** : `@Cron` lit les `AllowanceRule` actives dont
  `nextRunAt` est passé, crée une `Transaction` `ALLOWANCE`, met à jour le
  solde et `nextRunAt`.
- **Quiz** : questions hardcodées (seed), pas de génération IA. Un enfant
  récompensé une seule fois par question.

## Schéma GraphQL de référence

PROJECT_CONTEXT.md §6 est la source de vérité. Implémente en code-first :
les classes portent à la fois `@Entity()` (TypeORM) et `@ObjectType()`
(GraphQL) pour éviter de dupliquer les modèles.

## Coach IA (Mistral)

Mutation `generateAICoachInsight` (à la demande, pas en tâche de fond).
Récupère `Recommendation` actives + `Transaction` récentes + éventuellement
`Mission`/`QuizAttempt`, envoie à l'API Mistral, stocke le résultat dans
`AIInsight` (avec `domainScores` en JSON). La clé API passe par la variable
d'environnement `MISTRAL_API_KEY` — jamais en dur.

## Health-check

Le backend expose `GET /health` (200 OK) pour compatibilité load balancer /
orchestrateur cloud.
