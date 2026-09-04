# Web — Next.js (espace parent + page publique de don)

## Avant tout

Lis `PROJECT_CONTEXT.md` en entier, puis `../AGENTS.md`. Ce fichier ajoute les
contraintes spécifiques au web.

## Périmètre

Tu travailles dans `web/` uniquement. Tu consommes le schéma GraphQL défini
côté backend (PROJECT_CONTEXT.md §6) — tu ne le modifies pas. Toute
évolution du contrat passe par une PR backend d'abord.

## Stack

- Next.js (App Router ou Pages Router au choix, mais justifier et rester
  cohérent).
- Consommation de l'API GraphQL du backend (Apollo Client ou équivalent).
- Pas de stockage de fichiers local persistant (si besoin, prévoir un stockage
  objet S3-compatible).

## Pages attendues

- **Espace parent** (auth JWT parent) : gestion des enfants (solde,
  transactions, missions, cagnottes, recharges, blocage carte,
  recommandations, coach IA).
- **Page publique de don sur cagnotte** : pas d'auth, accessible via le
  `publicToken` de la cagnotte. Appelle la mutation
  `contributeToPotPublic` (la seule mutation publique de l'API). Prévoir un
  throttling anti-abus côté UI (le backend valide aussi).

## Sécurité

- Le JWT parent est stocké côté client (httpOnly cookie recommandé) — jamais
  exposé dans l'URL.
- La page de don publique n'utilise aucun JWT.

## Commentaires

Next.js est maîtrisé par le propriétaire du projet → commentaires normaux.
Pas besoin du niveau de détail demandé pour NestJS/GraphQL/PostgreSQL.

## Portabilité

Le service a son propre `Dockerfile` autonome, buildable indépendamment du
`docker-compose`. Toute config (URL du backend GraphQL, secrets éventuels)
passe par variables d'environnement.
