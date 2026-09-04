import { Query, Resolver } from '@nestjs/graphql';

/*
 * HealthResolver : query GraphQL de health-check.
 *
 * @Resolver() : décorateur NestJS/graphql qui déclare cette classe comme un resolver GraphQL.
 * Un resolver contient les handlers des queries/mutations/subscriptions GraphQL.
 * Sans argument, @Resolver() est utilisé quand le resolver ne référence pas un type objet
 * spécifique (contrairement à @Resolver(() => ChildAccount) qui attache des field resolvers
 * au type ChildAccount).
 *
 * Pourquoi ce resolver existe :
 * GraphQL exige qu'un schéma ait au moins un type Query (le "Query root type"). En mode
 * code-first, NestJS génère le schéma à partir des décorateurs @Query/@Mutation/@ObjectType
 * trouvés dans les resolvers. Sans aucun resolver, le schéma est vide → erreur
 * "Query root type must be provided" au démarrage. Ce resolver fournit une query minimale
 * `health` qui rend le schéma valide, tant que les resolvers métier ne sont pas implémentés.
 *
 * @Query(() => Boolean) : déclare une query GraphQL nommée d'après la méthode (ici `health`),
 * retournant un Boolean. Le schéma généré contiendra : `type Query { health: Boolean! }`.
 */
@Resolver()
export class HealthResolver {
  @Query(() => Boolean)
  health(): boolean {
    return true;
  }
}
