import { Args, ID, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
// ID : voir users.resolver.ts — typage explicite requis pour les args d'identifiant
// (childId, potId ici) afin de générer `ID!` et non `String!` dans le schéma GraphQL.
import { UseGuards, Inject } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { PotsService } from './pots.service.js';
import { Pot, WithdrawalPolicy } from './entities/pot.entity.js';
import { PublicPot } from './entities/public-pot.entity.js';
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
 * - Query potByPublicToken : lecture publique d'une cagnotte par son token (@Public()).
 * - Mutation createPot : un parent crée une cagnotte (PARENT only).
 * - Mutation contributeToPotPublic : don public SANS auth (@Public()).
 * - Mutation withdrawFromPot : retrait d'une cagnotte (parent ou enfant selon policy).
 * - Mutation updatePot : un parent modifie une cagnotte OPEN (PARENT only).
 * - Mutation deletePot : un parent supprime une cagnotte vide (PARENT only).
 */
@Resolver(() => Pot)
export class PotsResolver {
  // PubSub injecté via le token 'PUB_SUB' (PubSubModule @Global). Utilisé par
  // la subscription potUpdated pour exposer un AsyncIterator sur le topic
  // POT_UPDATED_{childId} publié par PotsService.contributeToPotPublic.
  constructor(
    private potsService: PotsService,
    @Inject('PUB_SUB') private pubSub: PubSub,
  ) {}

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
    @Args('childId', { type: () => ID }) childId: string,
  ): Promise<Pot[]> {
    return this.potsService.getPotsForChild(childId, user);
  }

  /*
   * Query potByPublicToken : lecture publique d'une cagnotte par son token.
   *
   * Schéma §6 : potByPublicToken(publicToken: String!): PublicPot!
   *
   * @Public() : exclut cette query du GqlAuthGuard global. C'est une route
   *   non authentifiée, au même titre que contributeToPotPublic (PROJECT_CONTEXT
   *   §8). La page de don /donate/[token] (Next.js, sans JWT) l'appelle pour
   *   afficher le titre, l'objectif et la progression avant le formulaire.
   *   Pas de @CurrentUser() ici : il n'y a pas de JWT.
   *
   * Sécurité — pourquoi PublicPot et pas Pot :
   *   Le type Pot complet expose childId, hiddenFrom, publicToken, l'ID interne…
   *   autant de données internes qu'un appelant anonyme ne doit pas voir. On
   *   retourne donc un PublicPot (type de projection, voir
   *   public-pot.entity.ts) ne contenant que title, targetAmount, currentAmount
   *   et status. Le mapping Pot → PublicPot se fait ici explicitement champ par
   *   champ pour garantir qu'aucun champ interne n'est divulgué par oubli.
   *
   * Lecture seule : cette query ne modifie rien. La mutation publique d'écriture
   *   reste contributeToPotPublic. On réutilise le service existant
   *   getPotByPublicToken (qui lève NotFoundException si le token est inconnu).
   *
   * @Args('publicToken') publicToken : UUID exposé dans l'URL de don public.
   */
  @Query(() => PublicPot)
  @Public()
  async potByPublicToken(
    @Args('publicToken') publicToken: string,
  ): Promise<PublicPot> {
    const pot = await this.potsService.getPotByPublicToken(publicToken);
    return {
      title: pot.title,
      targetAmount: pot.targetAmount,
      currentAmount: pot.currentAmount,
      status: pot.status,
    };
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
    @Args('childId', { type: () => ID }) childId: string,
    @Args('title') title: string,
    @Args('targetAmount') targetAmount: number,
    // type: () => WithdrawalPolicy : typage explicite requis car reflect-metadata
    // infère String pour les args enum, ce qui génère `String!` au lieu de
    // `WithdrawalPolicy!` dans le schéma GraphQL (même classe de bug que les ID).
    @Args('withdrawalPolicy', { type: () => WithdrawalPolicy }) withdrawalPolicy: WithdrawalPolicy,
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
    @Args('potId', { type: () => ID }) potId: string,
    @Args('amount') amount: number,
  ): Promise<Transaction> {
    return this.potsService.withdrawFromPot({
      potId,
      amount,
      requester: user,
    });
  }

  /*
   * Mutation updatePot : un parent modifie une cagnotte (édition partielle).
   *
   * Schéma §6 : updatePot(potId: ID!, title: String, targetAmount: Float,
   *   withdrawalPolicy: WithdrawalPolicy): Pot!
   *
   * @UseGuards(RolesGuard) + @Roles(Role.PARENT) : seul un PARENT peut modifier
   * une cagnotte. L'appartenance à la même famille est vérifiée dans le service.
   *
   * Les trois champs d'édition (title, targetAmount, withdrawalPolicy) sont
   * optionnels : seuls les champs fournis sont mis à jour.
   *
   * @Args('potId') potId : ID de la cagnotte à modifier.
   * @Args('title', { nullable: true }) : nouveau titre (optionnel).
   * @Args('targetAmount', { nullable: true }) : nouvel objectif (optionnel,
   *   doit être >= currentAmount).
   * @Args('withdrawalPolicy', { nullable: true }) : nouvelle policy (optionnel).
   * @CurrentUser() user : payload JWT du parent.
   */
  @Mutation(() => Pot)
  @UseGuards(RolesGuard)
  @Roles(Role.PARENT)
  async updatePot(
    @CurrentUser() user: JwtPayload,
    @Args('potId', { type: () => ID }) potId: string,
    @Args('title', { nullable: true }) title?: string,
    @Args('targetAmount', { nullable: true }) targetAmount?: number,
    @Args('withdrawalPolicy', { type: () => WithdrawalPolicy, nullable: true })
    withdrawalPolicy?: WithdrawalPolicy,
  ): Promise<Pot> {
    return this.potsService.updatePot({
      potId,
      title,
      targetAmount,
      withdrawalPolicy,
      requester: user,
    });
  }

  /*
   * Mutation deletePot : un parent supprime une cagnotte vide.
   *
   * Schéma §6 : deletePot(potId: ID!): Boolean!
   *
   * @UseGuards(RolesGuard) + @Roles(Role.PARENT) : seul un PARENT peut supprimer
   * une cagnotte. L'appartenance à la même famille est vérifiée dans le service.
   *
   * La cagnotte doit être vide (currentAmount === 0). Si elle contient de
   * l'argent, le service lève une BadRequestException.
   *
   * @Args('potId') potId : ID de la cagnotte à supprimer.
   * @CurrentUser() user : payload JWT du parent.
   */
  @Mutation(() => Boolean)
  @UseGuards(RolesGuard)
  @Roles(Role.PARENT)
  async deletePot(
    @CurrentUser() user: JwtPayload,
    @Args('potId', { type: () => ID }) potId: string,
  ): Promise<boolean> {
    return this.potsService.deletePot({ potId, requester: user });
  }

  /*
   * Subscription potUpdated : notifie en temps réel quand une cagnotte de
   * l'enfant est mise à jour par un don public (contributeToPotPublic).
   *
   * Schéma §6 : potUpdated(childId: ID!): Pot!
   *
   * Pourquoi cette subscription existe :
   *   Une contribution publique (page de don Next.js sans auth) augmente
   *   pot.currentAmount mais ne crée PAS de Transaction sur le solde principal.
   *   Les subscriptions balanceUpdated / transactionAdded ne se déclenchent donc
   *   pas. potUpdated est le seul canal par lequel l'app enfant apprend qu'un
   *   don est arrivé sur sa cagnotte.
   *
   * Fonctionnement des subscriptions GraphQL (voir balanceUpdated dans
   * transactions.resolver.ts) :
   *   1. Le client s'abonne via une requête subscription.
   *   2. Le resolver retourne un AsyncIterator (via pubSub.asyncIterator).
   *   3. Quand contributeToPotPublic publie POT_UPDATED_{childId}, tous les
   *      clients abonnés à ce childId reçoivent le Pot mis à jour.
   *
   * Note : on ne publie PAS potUpdated lors d'un retrait (withdrawFromPot).
   * Le retrait déclenche déjà balanceUpdated + transactionAdded via
   * addTransaction, ce qui suffit à notifier l'enfant. Un potUpdated
   * supplémentaire générerait un SnackBar redondant.
   *
   * @Args('childId') childId : ID de l'enfant propriétaire de la cagnotte.
   *
   * Filtre : le client ne reçoit que les événements pour le childId spécifié.
   * On compare payload.potUpdated.childId (le Pot porte childId = l'ID du User
   * enfant) à la variable childId de la subscription.
   */
  @Subscription(() => Pot, {
    filter: (payload, variables) =>
      payload.potUpdated.childId === variables.childId,
  })
  potUpdated(@Args('childId', { type: () => ID }) childId: string) {
    return this.pubSub.asyncIterator(`POT_UPDATED_${childId}`);
  }
}
