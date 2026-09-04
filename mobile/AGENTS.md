# Mobile — Flutter (côté enfant)

## Avant tout

Lis `PROJECT_CONTEXT.md` en entier, puis `../AGENTS.md`. Ce fichier ajoute les
contraintes spécifiques au mobile.

## Périmètre

Tu travailles dans `mobile/` uniquement. Tu consommes le schéma GraphQL défini
côté backend (PROJECT_CONTEXT.md §6) — tu ne le modifies pas. Toute
évolution du contrat passe par une PR backend d'abord.

## Stack

- Flutter, côté enfant.
- Client GraphQL (ex. `graphql_flutter` ou `ferry`) pour queries, mutations et
  subscriptions (solde temps réel, nouvelle transaction).

## Fonctionnalités côté enfant

- Auth avec son propre JWT (email/mot de passe, distinct de celui des
  parents).
- Solde en temps réel (subscription `balanceUpdated`).
- Historique des transactions + ajout manuel de dépense simulée.
- Cagnottes (création, suivi progression, retrait selon `withdrawalPolicy`).
- Missions (marquer comme fait, voir récompense).
- Quiz d'éducation financière (questions hardcodées, pas d'IA).
- Blocage/débloquage de carte (selon `blockedBy`).

## Bonus (si le temps le permet)

- Déverrouillage biométrique (`local_auth`).
- Masquage de l'app en vue multitâche (Android `FLAG_SECURE` via
  `flutter_windowmanager` ; iOS overlay flou au passage en arrière-plan).

## Commentaires

Flutter est maîtrisé par le propriétaire du projet → commentaires normaux.
Pas besoin du niveau de détail demandé pour NestJS/GraphQL/PostgreSQL.

## Portabilité

Le mobile n'est pas conteneurisé (Flutter tourne sur émulateur/device). La
config (URL du backend GraphQL) passe par variables d'environnement ou
config de build — jamais en dur.
