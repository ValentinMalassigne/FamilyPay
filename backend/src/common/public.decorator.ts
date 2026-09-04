import { SetMetadata } from '@nestjs/common';

/*
 * IS_PUBLIC_KEY : clé de métadonnée pour marquer une route comme publique.
 * Le GqlAuthGuard vérifie cette clé et laisse passer la requête sans JWT.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/*
 * @Public() : décorateur pour marquer un resolver comme accessible sans auth.
 *
 * Routes publiques (PROJECT_CONTEXT.md §8) :
 *   - signup (création de la première Family + premier parent)
 *   - login (connexion)
 *   - contributeToPotPublic (don public sur cagnotte, pas encore implémenté)
 *
 * Sans ce décorateur, le GqlAuthGuard (s'il est appliqué globalement) exige
 * un JWT sur tous les resolvers. @Public() isole clairement les routes
 * non authentifiées pour ne pas fragiliser le reste de l'API.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
