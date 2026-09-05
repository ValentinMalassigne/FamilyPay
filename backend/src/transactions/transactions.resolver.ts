import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { TransactionsService } from './transactions.service.js';
import { Transaction } from './entities/transaction.entity.js';
import { ChildAccount } from '../users/entities/child-account.entity.js';
import { RolesGuard } from '../common/roles.guard.js';
import { Roles } from '../common/roles.decorator.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { Role } from '../users/entities/user.entity.js';
import type { JwtPayload } from '../common/types.js';
import { PubSub } from 'graphql-subscriptions';

/*
 * TransactionsResolver : resolvers GraphQL pour les transactions.
 *
 * @Resolver(() => Transaction) : déclare un resolver attaché au type Transaction.
 * Cela permet de définir des field resolvers pour Transaction (si besoin) et
 * d'associer les queries/mutations/subscriptions qui retournent des Transaction.
 *
 * Authentification : GqlAuthGuard est global (APP_GUARD dans AppModule) → tous
 * les resolvers exigent un JWT valide par défaut. On n'a plus besoin de
 * @UseGuards(GqlAuthGuard) sur chaque méthode. RolesGuard reste appliqué
 * ponctuellement via @UseGuards(RolesGuard) + @Roles(...) pour les mutations
 * restreintes par rôle.
 *
 * Les resolvers ici gèrent :
 * - Query : transactions (historique des transactions d'un enfant)
 * - Mutations : addManualExpense, rechargeChildAccount
 * - Subscriptions : balanceUpdated (notification en temps réel du solde)
 */
@Resolver(() => Transaction)
export class TransactionsResolver {
  constructor(
    private transactionsService: TransactionsService,
    @Inject('PUB_SUB') private pubSub: PubSub,
  ) {}

  /*
   * Query transactions : retourne l'historique des transactions pour un enfant.
   *
   * @Query(() => [Transaction]) : déclare une query GraphQL qui retourne une liste
   * de Transaction. Le schéma généré contiendra :
   *   transactions(childId: ID!): [Transaction!]!
   *
   * GqlAuthGuard est global (APP_GUARD) → JWT vérifié automatiquement.
   *
   * @Args('childId') childId : ID de l'enfant dont on veut l'historique.
   * @CurrentUser() user : payload JWT de l'utilisateur actuel.
   *
   * Règles métier :
   * - Un parent peut voir les transactions de n'importe quel enfant de SA famille.
   * - Un enfant peut voir UNIQUEMENT ses propres transactions.
   *
   * @throws ForbiddenException si l'utilisateur n'a pas le droit de voir ces transactions.
   */
  @Query(() => [Transaction])
  async transactions(
    @CurrentUser() user: JwtPayload,
    @Args('childId') childId: string,
  ): Promise<Transaction[]> {
    // Vérifier que l'utilisateur a le droit de voir les transactions de cet enfant.
    // Un parent peut voir les transactions de n'importe quel enfant de SA famille.
    // Un enfant peut voir UNIQUEMENT ses propres transactions.
    const isSameUser = user.sub === childId;
    const isParent = user.role === Role.PARENT;

    if (!isSameUser && !isParent) {
      throw new Error(
        `Seul un parent ou l'enfant lui-même peut voir ces transactions`,
      );
    }

    // Si c'est un parent, vérifier que l'enfant fait partie de sa famille.
    if (isParent && !isSameUser) {
      const child = await this.transactionsService['usersService'].findById(
        childId,
      );
      if (!child || child.familyId !== user.familyId) {
        throw new Error(
          `Vous n'avez pas le droit de voir les transactions de cet enfant`,
        );
      }
    }

    return this.transactionsService.getTransactions(childId);
  }

  /*
   * Mutation addManualExpense : ajoute une dépense manuelle pour un enfant.
   *
   * @Mutation(() => Transaction) : déclare une mutation GraphQL qui retourne
   * une Transaction. Le schéma généré contiendra :
   *   addManualExpense(childId: ID!, amount: Float!, label: String!, category: String): Transaction!
   *
   * GqlAuthGuard est global (APP_GUARD) → JWT vérifié automatiquement.
   *
   * @Args('childId') childId : ID de l'enfant pour qui on ajoute la dépense.
   * @Args('amount') amount : montant de la dépense (positif, ex: 10 pour 10€).
   *   Sera converti en négatif dans le service.
   * @Args('label') label : libellé de la dépense (ex: "Dépense chez McDo").
   * @Args('category') category : catégorie optionnelle (ex: "Fast-food").
   * @CurrentUser() user : payload JWT de l'utilisateur actuel.
   *
   * Règles métier :
   * - Un parent peut ajouter une dépense pour n'importe quel enfant de SA famille.
   * - Un enfant peut ajouter une dépense UNIQUEMENT pour lui-même.
   *
   * @throws ForbiddenException si l'utilisateur n'a pas le droit.
   */
  @Mutation(() => Transaction)
  async addManualExpense(
    @CurrentUser() user: JwtPayload,
    @Args('childId') childId: string,
    @Args('amount') amount: number,
    @Args('label') label: string,
    @Args('category') category?: string,
  ): Promise<Transaction> {
    return this.transactionsService.addManualExpense({
      childId,
      amount,
      label,
      category,
      creator: user,
    });
  }

  /*
   * Mutation rechargeChildAccount : recharge le compte d'un enfant (crédit manuel).
   *
   * @Mutation(() => Transaction) : déclare une mutation GraphQL qui retourne
   * une Transaction. Le schéma généré contiendra :
   *   rechargeChildAccount(childId: ID!, amount: Float!): Transaction!
   *
   * @UseGuards(RolesGuard) : GqlAuthGuard est global (APP_GUARD), on n'a plus
   * besoin de le lister. RolesGuard vérifie @Roles(Role.PARENT).
   *
   * @Roles(Role.PARENT) : seul un parent peut recharger un compte.
   *
   * @Args('childId') childId : ID de l'enfant à recharger.
   * @Args('amount') amount : montant de la recharge (positif, ex: 20 pour 20€).
   * @CurrentUser() user : payload JWT du parent.
   *
   * Règles métier :
   * - Seuls les parents peuvent recharger un compte.
   * - L'enfant doit faire partie de la même famille que le parent.
   *
   * @throws ForbiddenException si l'utilisateur n'est pas un parent ou si l'enfant
   * n'est pas dans sa famille.
   */
  @Mutation(() => Transaction)
  @UseGuards(RolesGuard)
  @Roles(Role.PARENT)
  async rechargeChildAccount(
    @CurrentUser() user: JwtPayload,
    @Args('childId') childId: string,
    @Args('amount') amount: number,
  ): Promise<Transaction> {
    return this.transactionsService.rechargeChildAccount({
      childId,
      amount,
      creator: user,
    });
  }

  /*
   * Subscription balanceUpdated : notifie en temps réel quand le solde d'un enfant est mis à jour.
   *
   * @Subscription(() => ChildAccount) : déclare une subscription GraphQL qui retourne
   * un ChildAccount. Le schéma généré contiendra :
   *   balanceUpdated(childId: ID!): ChildAccount!
   *
   * Fonctionnement des subscriptions GraphQL :
   *   1. Le client s'abonne via une requête GraphQL spéciale (ex: subscription { balanceUpdated(childId: "...") { balance } })
   *   2. Le resolver retourne un AsyncIterator (via pubSub.asyncIterator).
   *   3. Quand un événement est publié (via pubSub.publish), tous les clients abonnés
   *      reçoivent la donnée en temps réel via WebSocket.
   *
   * @Args('childId') childId : ID de l'enfant dont on veut suivre le solde.
   *
   * Filtre :
   *   - Le client ne reçoit que les mises à jour pour le childId spécifié.
   *   - En production, on pourrait ajouter un filtre supplémentaire pour vérifier
   *     que l'utilisateur a le droit de voir ce ChildAccount (via le JWT dans le contexte).
   *     Pour ce MVP, on se base sur le childId passé en argument.
   *
   * Note : Apollo Server gère automatiquement les connexions WebSocket pour les subscriptions.
   */
  @Subscription(() => ChildAccount, {
    filter: (payload, variables) => {
      // Filtrer pour ne notifier que les clients abonnés à ce childId spécifique.
      return payload.balanceUpdated.userId === variables.childId;
    },
  })
  balanceUpdated(@Args('childId') childId: string) {
    // Retourne un AsyncIterator pour le topic BALANCE_UPDATED_{childId}.
    // Quand un événement est publié sur ce topic, le client reçoit la donnée.
    return this.pubSub.asyncIterator(`BALANCE_UPDATED_${childId}`);
  }
}
