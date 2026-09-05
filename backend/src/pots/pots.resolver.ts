import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { PotsService } from './pots.service.js';
import { Pot, WithdrawalPolicy } from './entities/pot.entity.js';
import { PotContribution } from './entities/pot-contribution.entity.js';
import { Transaction } from '../transactions/entities/transaction.entity.js';
import { RolesGuard } from '../common/roles.guard.js';
import { Roles } from '../common/roles.decorator.js';
import { Public } from '../common/public.decorator.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { Role } from '../users/entities/user.entity.js';
import type { JwtPayload } from '../common/types.js';

/*
 * PotsResolver : resolvers GraphQL pour les cagnottes (Pot).
 *
 * @Resolver(() => Pot) : déclare un resolver attaché au type Pot.
 *
 * Authentification : GqlAuthGuard est global (APP_GUARD) → tous les resolvers
 * exigent un JWT par défaut, SAUF contributeToPotPublic qui est marqué @Public().
 *
 * Resolvers définis :
 * - Query pots : liste les cagnottes d'un enfant (parent ou enfant lui-même).
 * - Mutation createPot : un parent crée une cagnotte (PARENT only).
 * - Mutation contributeToPotPublic : don public SANS auth (@Public()).
 * - Mutation withdrawFromPot : retrait d'une cagnotte (parent ou enfant selon policy).
 */
@Resolver(() => Pot)
export class PotsResolver {
  constructor(private potsService: PotsService) {}

  /*
   * Query pots : retourne les cagnottes d'un enfant visibles par l'appelant.
   *
   * Schéma §6 : pots(childId: ID!): [Pot!]!
   *
   * GqlAuthGuard (global) vérifie le JWT. Pas de @Roles ici : un parent OU
   * l'enfant lui-même peut consulter les cagnottes (le filtrage hiddenFrom est
   * géré dans le service).
   *
   * @Args('childId') childId : ID de l'enfant dont on veut les cagnottes.
   * @CurrentUser() user : payload JWT de l'appelant (parent ou enfant).
   */
  @Query(() => [Pot])
  async pots(
    @CurrentUser() user: JwtPayload,
    @Args('childId') childId: string,
  ): Promise<Pot[]> {
    return this.potsService.getPotsForChild(childId, user);
  }

  /*
   * Mutation createPot : un parent crée une cagnotte d'épargne pour un enfant.
   *
   * Schéma §6 : createPot(childId: ID!, title: String!, targetAmount: Float!,
   *   withdrawalPolicy: WithdrawalPolicy!): Pot!
   *
   * Guards :
   * - GqlAuthGuard (global) vérifie le JWT.
   * - @UseGuards(RolesGuard) + @Roles(Role.PARENT) : seul un PARENT peut créer
   *   une cagnotte. L'appartenance à la même famille est vérifiée dans le service.
   *
   * @Args('withdrawalPolicy') : enum WithdrawalPolicy (ANYTIME | WHEN_FULL |
   *   PARENT_ONLY). NestJS mappe automatiquement la string GraphQL vers l'enum
   *   TypeScript grâce à registerEnumType.
   */
  @Mutation(() => Pot)
  @UseGuards(RolesGuard)
  @Roles(Role.PARENT)
  async createPot(
    @CurrentUser() creator: JwtPayload,
    @Args('childId') childId: string,
    @Args('title') title: string,
    @Args('targetAmount') targetAmount: number,
    @Args('withdrawalPolicy') withdrawalPolicy: WithdrawalPolicy,
  ): Promise<Pot> {
    return this.potsService.createPot({
      childId,
      title,
      targetAmount,
      withdrawalPolicy,
      creator,
    });
  }

  /*
   * Mutation contributeToPotPublic : don public sur une cagnotte, SANS auth.
   *
   * Schéma §6 : contributeToPotPublic(publicToken: String!, amount: Float!,
   *   contributorName: String): PotContribution!
   *
   * @Public() : exclut cette mutation du GqlAuthGuard global. C'est la SEULE
   * route non authentifiée de l'API (PROJECT_CONTEXT.md §8). Le décorateur
   * @Public() est nécessaire car GqlAuthGuard est registered via APP_GUARD —
   * sans lui, toute mutation exigerait un JWT.
   *
   * Pas de @CurrentUser() ici : il n'y a pas de JWT. La validation se fait
   * uniquement sur le publicToken (la cagnotte doit exister) et le montant
   * (positif, plafonné à la place restante).
   *
   * @Args('publicToken') : UUID exposé dans l'URL de don public.
   * @Args('contributorName') : nom du donateur (optionnel, texte libre).
   */
  @Mutation(() => PotContribution)
  @Public()
  async contributeToPotPublic(
    @Args('publicToken') publicToken: string,
    @Args('amount') amount: number,
    @Args('contributorName', { nullable: true }) contributorName?: string,
  ): Promise<PotContribution> {
    return this.potsService.contributeToPotPublic({
      publicToken,
      amount,
      contributorName,
    });
  }

  /*
   * Mutation withdrawFromPot : retire de l'argent d'une cagnotte.
   *
   * Schéma §6 : withdrawFromPot(potId: ID!, amount: Float!): Transaction!
   *
   * GqlAuthGuard (global) vérifie le JWT. Pas de @Roles ici : un parent OU
   * l'enfant propriétaire peut retirer, mais la policy (withdrawalPolicy) est
   * vérifiée dans le service :
   *  - parent → toujours autorisé.
   *  - enfant → soumis à la policy (ANYTIME / WHEN_FULL / PARENT_ONLY).
   *
   * @Args('potId') potId : ID de la cagnotte à retirer.
   * @Args('amount') amount : montant à retirer (positif).
   * @CurrentUser() user : payload JWT de l'appelant (parent ou enfant).
   */
  @Mutation(() => Transaction)
  async withdrawFromPot(
    @CurrentUser() user: JwtPayload,
    @Args('potId') potId: string,
    @Args('amount') amount: number,
  ): Promise<Transaction> {
    return this.potsService.withdrawFromPot({
      potId,
      amount,
      requester: user,
    });
  }
}
