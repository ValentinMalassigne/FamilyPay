# Projet "FamilyPay" — App de gestion d'argent de poche pour ados

## 1. Contexte

Projet personnel réalisé pour démontrer une maîtrise de NestJS, GraphQL, PostgreSQL, Flutter, Next.js, Docker et l'intégration d'une IA (API Mistral), dans le cadre d'une candidature en alternance. Inspiré du produit Pixpay (carte bancaire + éducation financière pour ados), sans lien commercial ni reproduction de leur code/design.

Contrainte de temps : développement rapide (quelques jours). Priorité donnée à la robustesse du cœur du produit et à la qualité de code sur le backend (NestJS/GraphQL/PostgreSQL), plutôt qu'à l'exhaustivité des fonctionnalités.

## 2. Vue d'ensemble produit

Une famille est composée d'un ou deux parents et d'un ou plusieurs enfants ("ados"). Chaque enfant a son propre compte avec identifiants de connexion (email/mot de passe), un solde, un historique de transactions simulées, des cagnottes d'épargne, des missions rémunérées et un quizz d'éducation financière. Les parents pilotent l'argent de poche, valident les missions, définissent des recommandations de vie (santé, environnement, budget...) et suivent l'activité de l'enfant en temps réel.

Aucune vraie carte bancaire ni vrai paiement : toutes les transactions (dépenses, virements) sont simulées en base de données.

## 3. Stack technique

- **Backend** : NestJS + GraphQL (Apollo, approche code-first avec `@nestjs/apollo`) + PostgreSQL via **TypeORM**
  - *Apollo plutôt que Mercurius* : bien plus documenté pour NestJS, communauté plus large, plus simple à débugger en autonomie et mieux couvert par les IA de code (moins de risque de code généré incorrect ou obsolète).
  - *TypeORM plutôt que Prisma* : permet de faire porter à une même classe les décorateurs `@Entity()` (TypeORM) et `@ObjectType()` (GraphQL), ce qui évite de dupliquer les modèles. C'est aussi l'approche la plus répandue dans les tutoriels et exemples NestJS+GraphQL+PostgreSQL, donc plus de chances que le code généré par l'IA soit fiable et idiomatique.
- **App mobile** : Flutter (côté enfant)
- **Site web** : Next.js (espace parent + page publique de don sur cagnotte, sans auth)
- **IA** : API Mistral (coach budget)
- **Conteneurisation** : Docker + docker-compose pour le dev local (services : backend, postgres, next.js, éventuellement redis si besoin de pub/sub pour les subscriptions)
- **Cloud** : pas de déploiement réel pendant le dev (tout tourne en local via docker-compose). Le projet doit néanmoins être conçu pour être déployable facilement sur un cloud (voir section 9).

## 4. Modèle de données (entités principales)

### User
- id, email, passwordHash, role (`PARENT` | `CHILD`), firstName, lastName, familyId, createdByUserId (nullable), createdAt
- Un enfant a son propre compte (email/mdp) et son propre JWT, distinct de celui de ses parents.

**Flux de création de comptes** : pas de système d'invitation par code/email. Le premier parent s'inscrit (crée sa `Family`). Depuis son espace, il peut ensuite créer directement des comptes email + mot de passe pour ses enfants et pour un second parent au sein de la même famille (mutation réservée au rôle `PARENT`, l'utilisateur créé hérite du `familyId` du créateur).

### Family
- id, name
- Relation 1-N vers User (1 à 2 parents + N enfants). Pas de gestion multi-famille complexe : une famille = un groupe fermé de parents/enfants qui se voient entre eux (sauf règles de visibilité spécifiques, ex. cagnotte cachée).

### ChildAccount
- id, userId (FK vers User role=CHILD), balance (solde courant, **stocké et mis à jour à chaque transaction**, pas recalculé à la volée), blocked (bool), blockedBy (`PARENT` | `CHILD` | null)
- Chaque enfant a son propre solde indépendant, comme de l'argent liquide dans son portefeuille. **Il n'y a pas de wallet/solde suivi côté parent** : le parent n'est pas débité dans le système, on considère qu'il recharge le compte de l'enfant via un paiement par carte bancaire simulé (pas de vraie intégration paiement).
- Le parent dispose de deux moyens de créditer le compte d'un enfant : une **recharge ponctuelle manuelle** (mutation, à tout moment) et un **virement automatique mensuel/hebdomadaire** (voir `AllowanceRule` ci-dessous). Les deux sont indépendants et cumulables.

**Règle métier — blocage de carte** : le champ `blockedBy` détermine qui a la priorité. Si `blockedBy = PARENT`, seul un parent peut débloquer. Si `blockedBy = CHILD` (ou null), l'enfant peut lui-même bloquer/débloquer. Un parent peut toujours bloquer/débloquer quel que soit l'état actuel.

**Règle métier — solde non négatif** : le solde d'un enfant ne peut **jamais** passer en négatif. On simule une carte bancaire pour ados, pas un découvert autorisé. Tout débit (EXPENSE, POT_WITHDRAWAL...) qui ferait passer `balance` sous 0 est rejeté côté backend (`BadRequestException`). Les crédits (RECHARGE, ALLOWANCE, MISSION_REWARD, QUIZ_REWARD, POT_CONTRIBUTION) sont toujours autorisés.

### Transaction
- id, childId, amount (positif = crédit, négatif = débit), type (`RECHARGE` | `ALLOWANCE` | `EXPENSE` | `MISSION_REWARD` | `QUIZ_REWARD` | `POT_CONTRIBUTION` | `POT_WITHDRAWAL`), label, category (optionnel, ex. "Fast-food", "Loisirs"), createdAt, createdBy (`SYSTEM` | `CHILD` | `PARENT`)
- `RECHARGE` : recharge manuelle ponctuelle par un parent (paiement CB simulé, pas de vrai encaissement)
- `ALLOWANCE` : versement automatique récurrent généré par le cron (voir `AllowanceRule`)
- Les dépenses simulées peuvent être ajoutées manuellement par l'enfant depuis l'app (ex. "j'ai dépensé 5€ chez Y").

### AllowanceRule (virement automatique récurrent)
- id, childId, amount, frequency (`WEEKLY` | `MONTHLY`), nextRunAt, active (bool)
- Défini par un parent. Exécuté par un cron NestJS (`@nestjs/schedule`) qui crée une `Transaction` de type `ALLOWANCE` et met à jour le solde. Indépendant des recharges manuelles ponctuelles (`RECHARGE`).

### Pot (cagnotte)
- id, childId, title, targetAmount, currentAmount, publicToken (UUID, pour le lien de don public), hiddenFrom (liste d'userId de parents à qui la cagnotte est masquée — vide par défaut = visible par toute la famille), withdrawalPolicy (`ANYTIME` | `WHEN_FULL` | `PARENT_ONLY`, défini par le parent à la création de la cagnotte)
- Une cagnotte est toujours visible par l'enfant propriétaire. `hiddenFrom` permet de masquer une cagnotte à un parent spécifique (ex. cagnotte "cadeau papa" avec `hiddenFrom = [id du père]`).

**Règle métier — retrait de cagnotte** : `withdrawalPolicy` détermine si l'enfant peut retirer librement (`ANYTIME`), uniquement une fois l'objectif atteint (`WHEN_FULL`), ou jamais lui-même (`PARENT_ONLY`, seul un parent peut transférer l'argent vers le solde principal). **Dans tous les cas, un parent peut effectuer le retrait lui-même**, quelle que soit la policy — le guard sur la mutation de retrait doit distinguer l'appelant (enfant → vérifier la policy ; parent → toujours autorisé).

### PotContribution
- id, potId, amount, contributorName (texte libre, optionnel — pour les dons publics anonymes ou signés), createdAt, isPublicDonation (bool)
- Une contribution publique (via le lien, sans auth) crée une `PotContribution` + une `Transaction` de type `POT_CONTRIBUTION` sur le compte de l'enfant.
- **Montant plafonné** : le montant d'une contribution (publique ou non) ne peut pas dépasser la place restante dans la cagnotte (`targetAmount - currentAmount`), pour éviter tout dépassement de l'objectif. À valider côté resolver avant insertion.

### Mission
- id, childId, createdByParentId, title, description, reward, status (`PENDING` | `DONE_BY_CHILD` | `VALIDATED` | `REJECTED`), createdAt, completedAt, validatedAt
- Flux : parent crée (`PENDING`) → enfant marque fait (`DONE_BY_CHILD`) → parent valide (`VALIDATED`, déclenche une `Transaction` de type `MISSION_REWARD`) ou refuse (`REJECTED`).

### Quiz / QuizQuestion
- Questions hardcodées en base (seed), pas de génération IA. id, question, choices (array), correctAnswerIndex, reward, category
- QuizAttempt : id, childId, quizId, success (bool), rewardedAt — un enfant ne peut être récompensé qu'une seule fois par question.
- **Contenu du seed (MVP)** : 4 questions QCM à 3 choix chacune, thème unique "gestion des dépenses" (ex. reconnaître et résister à une fausse bonne affaire promotionnelle en supermarché). Pas de multi-catégories pour cette itération.

### Recommendation (recommandation parentale)
- id, parentId, childId, domain (`ENVIRONMENT` | `HEALTH` | `BUDGET` | `ASSOCIATIVE`), description (texte libre défini par le parent, ex. "privilégier les transports en commun")
- Sert de contexte à l'IA coach (section 7).

### AIInsight (rapport du coach IA)
- id, childId, period (ex. date de génération), content (texte généré), domainScores (JSON — ex. `{BUDGET: "bien suivi", ENVIRONMENT: "peu suivi"}`), generatedAt

## 5. Détail des fonctionnalités

### MVP (priorité haute)
1. Auth séparée parent/enfant (JWT), inscription d'une famille + ajout d'enfants
2. Solde enfant en temps réel (query + subscription GraphQL)
3. Argent de poche automatique (cron NestJS)
4. Historique des transactions + ajout manuel de dépense simulée par l'enfant
5. Cagnotte avec barre de progression + lien public de don (page Next.js sans auth)
6. Missions rémunérées (cycle complet parent ↔ enfant)
7. Blocage de carte avec priorité parent > enfant
8. Notifications temps réel via GraphQL Subscriptions (solde + nouvelle transaction)

### Bonus (si le temps le permet)
9. Quizz d'éducation financière rémunéré (questions hardcodées)
10. Cagnotte cachée à un parent spécifique
11. Recommandations parentales par domaine + coach IA Mistral (section 7)
12. Flutter : déverrouillage biométrique (`local_auth`)
13. Flutter : masquage de l'app en vue multitâche (Android : `FLAG_SECURE` via `flutter_windowmanager` ; iOS : overlay flou au passage en arrière-plan)

### Hors scope (explicitement non traité)
- Vrai paiement / vraie carte bancaire
- Partage de dépense entre comptes de familles différentes
- Fonctionnalités adaptées à l'âge (matrice de permissions par tranche d'âge)
- Multi-famille avancé (une famille = un groupe fermé simple)
- Missions récurrentes (uniquement des missions ponctuelles)
- Tests automatisés (unitaires/e2e) — non prévus pour cette itération, priorité donnée au périmètre fonctionnel vu le temps disponible

## 6. Schéma GraphQL (esquisse)

```graphql
type User {
  id: ID!
  email: String!
  role: Role!
  firstName: String!
  lastName: String!
}

type ChildAccount {
  id: ID!
  user: User!
  balance: Float!
  blocked: Boolean!
  blockedBy: BlockActor
  transactions: [Transaction!]!
  pots: [Pot!]!
  missions: [Mission!]!
}

type Transaction {
  id: ID!
  childId: ID!
  amount: Float!
  type: TransactionType!
  label: String
  category: String
  createdAt: DateTime!
  createdBy: CreatedBy!
}

type Pot {
  id: ID!
  title: String!
  targetAmount: Float!
  currentAmount: Float!
  publicToken: String!
  hiddenFrom: [ID!]!
  withdrawalPolicy: WithdrawalPolicy!
}

type Mission {
  id: ID!
  title: String!
  reward: Float!
  status: MissionStatus!
}

type AIInsight {
  id: ID!
  content: String!
  domainScores: JSON!
  generatedAt: DateTime!
}

# Queries
type Query {
  me: User!
  childAccount(childId: ID!): ChildAccount!
  transactions(childId: ID!): [Transaction!]!
  pots(childId: ID!): [Pot!]!
  missions(childId: ID!): [Mission!]!
  aiInsights(childId: ID!): [AIInsight!]!
}

# Mutations
type Mutation {
  login(email: String!, password: String!): AuthPayload!
  createChildAccount(email: String!, password: String!, firstName: String!, lastName: String!): User!
  createParentAccount(email: String!, password: String!, firstName: String!, lastName: String!): User!
  rechargeChildAccount(childId: ID!, amount: Float!): Transaction!
  addManualExpense(childId: ID!, amount: Float!, label: String!): Transaction!
  createPot(childId: ID!, title: String!, targetAmount: Float!, withdrawalPolicy: WithdrawalPolicy!): Pot!
  contributeToPotPublic(publicToken: String!, amount: Float!, contributorName: String): PotContribution!
  withdrawFromPot(potId: ID!, amount: Float!): Transaction!
  createMission(childId: ID!, title: String!, reward: Float!): Mission!
  markMissionDone(missionId: ID!): Mission!
  validateMission(missionId: ID!, approve: Boolean!): Mission!
  setCardBlocked(childId: ID!, blocked: Boolean!): ChildAccount!
  answerQuiz(quizId: ID!, answerIndex: Int!): QuizAttempt!
  setRecommendation(childId: ID!, domain: Domain!, description: String!): Recommendation!
  generateAICoachInsight(childId: ID!): AIInsight!
}

# Subscriptions
type Subscription {
  balanceUpdated(childId: ID!): ChildAccount!
  transactionAdded(childId: ID!): Transaction!
}
```

**Note sur `contributeToPotPublic`** : c'est la seule mutation accessible sans JWT (page publique Next.js). Elle doit être exclue du guard d'authentification global, avec sa propre validation (token de cagnotte valide, montant positif, éventuel throttling anti-abus).

## 7. Fonctionnalité IA — Coach budget (Mistral)

**Objectif** : analyser l'historique de transactions d'un enfant et vérifier si les recommandations définies par les parents (par domaine : environnement, santé, budget, associatif...) sont suivies dans les faits, puis générer un retour en langage naturel.

**Fonctionnement** :
1. Le backend récupère : les `Recommendation` actives du parent pour cet enfant + les `Transaction` récentes (catégories, montants, libellés) + éventuellement les `Mission` et `QuizAttempt`.
2. Ce contexte est envoyé à l'API Mistral avec un prompt qui demande : un score d'adhérence par domaine, un résumé synthétique, et 1-2 conseils concrets.
3. La réponse est stockée dans `AIInsight` (avec `domainScores` structuré en JSON) et affichée au parent et à l'enfant.

**Déclenchement** : à la demande (mutation `generateAICoachInsight`), pas en tâche de fond automatique — plus simple à démontrer et moins coûteux en appels API. Pas de limite de fréquence d'appel pour cette itération (projet de démo, pas de contrainte de coût réelle).

**Pas de génération de quizz par l'IA** : les questions du quizz restent hardcodées (seed en base), l'IA n'intervient que sur le coaching budgétaire.

## 8. Sécurité & auth

- JWT séparés parent/enfant, avec `role` dans le payload
- Guards NestJS par rôle sur les resolvers (ex. seul un parent peut créer une mission ou bloquer/débloquer si `blockedBy=PARENT`)
- Mot de passe hashé (bcrypt/argon2)
- La mutation publique de don sur cagnotte est la seule route non authentifiée — à isoler clairement dans le code (guard dédié) pour ne pas fragiliser le reste de l'API

## 9. Déploiement & portabilité cloud

Pendant le développement : tout tourne en local via `docker-compose` (services : `backend`, `postgres`, `nextjs`, éventuellement `mobile` non conteneurisé car Flutter tourne sur émulateur/device).

Pour rester facilement déployable sur un cloud plus tard (plateforme non encore choisie) :
- Chaque service (`backend`, `nextjs`) a son propre `Dockerfile` autonome, buildable indépendamment du `docker-compose`
- Toute config (URL DB, secrets JWT, clé API Mistral) passe par variables d'environnement, jamais en dur dans le code
- Le backend expose un endpoint de health-check (`/health`) pour compatibilité avec un load balancer / orchestrateur cloud
- PostgreSQL doit pouvoir être remplacé par une instance managée (ex. RDS) sans changement de code — uniquement la variable de connexion change
- Pas de dépendance à un stockage de fichiers local persistant (si besoin de fichiers, prévoir un stockage objet type S3-compatible dès la conception)

## 10. Conventions de code — commentaires obligatoires

Contrainte importante : je suis débutant sur NestJS, GraphQL et PostgreSQL. Toute IA travaillant sur ce projet doit donc **commenter systématiquement** le code touchant à ces trois technologies, pour que je puisse comprendre ce qui est généré, pas seulement le faire fonctionner :

- **NestJS** : expliquer en commentaire le rôle de chaque décorateur non trivial (`@Injectable`, `@Resolver`, `@UseGuards`, `@Cron`...), pourquoi un module/provider est structuré ainsi, et le flux d'injection de dépendances quand il n'est pas évident.
- **GraphQL** : commenter les resolvers pour expliquer ce que fait chaque query/mutation/subscription, pourquoi un guard ou un type d'entrée est utilisé, et comment fonctionne le mécanisme de subscription (pub/sub) là où il est mis en place.
- **PostgreSQL / ORM** : commenter les entités (relations, contraintes, index), les migrations, et toute requête un peu complexe (jointures, agrégations) en expliquant ce qu'elle fait et pourquoi.
- Le code purement Flutter/Next.js déjà maîtrisé n'a pas besoin de ce niveau de détail — les commentaires doivent se concentrer sur les technologies non maîtrisées.
- Objectif : pouvoir répondre en entretien à "explique-moi ce bout de code" sans hésitation, même sur une partie générée par l'IA.

## 11. Workflow Git

**Branches**
- `main` : branche de releases stables, jamais de commit direct dessus. Elle est mise à jour uniquement par PR depuis `development` au moment d'une démo ou d'une release.
- `development` : branche d'intégration, cible de toutes les PR de feature.
- Une branche par fonctionnalité, préfixée par type : `feat/...`, `fix/...`, `chore/...`, `docs/...` (ex. `feat/backend-mission-flow`, `feat/mobile-biometric-unlock`). Les branches de feature partent de `development` et y sont mergées via une Pull Request (même en solo — ça garde un historique de revue propre et montre une pratique d'équipe en entretien), une fois la fonctionnalité fonctionnelle. Pour en créer une : `git checkout development && git pull && git checkout -b feat/...`

**Commits — Conventional Commits, atomiques**
- Format : `type(scope): description au présent, en minuscule, sans point final`
- Types utilisés : `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `style`
- Scope = zone du monorepo concernée : `backend`, `web`, `mobile`, `infra`
- Un commit = un changement logique cohérent (pas de commit fourre-tout mélangeant plusieurs sujets ; pas non plus de micro-commits qui cassent la compilation entre eux)

Exemples :
```
feat(backend): add mission validation resolver and service
fix(mobile): correct balance refresh after allowance cron
refactor(backend): extract card-block priority logic into dedicated service
docs: update PROJECT_CONTEXT with git workflow
chore(infra): add postgres service to docker-compose
```

- Corps de commit optionnel mais recommandé pour les changements non triviaux, expliquant le "pourquoi" plutôt que le "quoi" (le diff montre déjà le quoi)
- Toute IA travaillant sur ce projet doit committer par petites étapes atomiques suivant cette convention, plutôt que produire un unique gros commit en fin de tâche

## 12. Roadmap / évolutions non traitées ici

- Partage de dépense entre comptes de familles différentes
- Adaptation des fonctionnalités par tranche d'âge
- Vraie intégration bancaire / carte physique
- CI/CD (GitHub Actions) pour build/push automatique des images Docker