import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
// ID : voir users.resolver.ts — typage explicite requis pour les args d'identifiant
// (childId ici) afin de générer `ID!` et non `String!` dans le schéma GraphQL.
import { UseGuards } from '@nestjs/common';
import { AllowancesService } from './allowances.service.js';
import { AllowanceRule, AllowanceFrequency } from './entities/allowance-rule.entity.js';
import { RolesGuard } from '../common/roles.guard.js';
import { Roles } from '../common/roles.decorator.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { Role } from '../users/entities/user.entity.js';
import type { JwtPayload } from '../common/types.js';

/*
 * AllowancesResolver : resolvers GraphQL pour les virements automatiques.
 *
 * @Resolver(() => AllowanceRule) : resolver attaché au type AllowanceRule.
 *
 * Authentification : GqlAuthGuard (global via APP_GUARD) vérifie le JWT.
 *
 * Resolvers définis :
 * - Query allowanceRules : liste les règles de virement d'un enfant.
 * - Mutation createAllowanceRule : un parent crée un virement récurrent.
 * - Mutation updateAllowanceRule : un parent modifie un virement (PARENT only).
 * - Mutation deleteAllowanceRule : un parent supprime un virement (PARENT only).
 *
 * Le cron @Cron (processDueAllowances) n'est PAS un resolver — il tourne en
 * arrière-plan dans AllowancesService et n'est pas exposé via GraphQL.
 */
@Resolver(() => AllowanceRule)
export class AllowancesResolver {
  constructor(private allowancesService: AllowancesService) {}

  /*
   * Query allowanceRules : retourne les règles de virement d'un enfant.
   *
   * GqlAuthGuard (global) vérifie le JWT. Pas de @Roles : un parent OU
   * l'enfant lui-même peut consulter (le filtrage famille est géré dans le
   * service).
   *
   * @Args('childId') : ID de l'enfant dont on veut les règles.
   */
  @Query(() => [AllowanceRule])
  async allowanceRules(
    @CurrentUser() user: JwtPayload,
    @Args('childId', { type: () => ID }) childId: string,
  ): Promise<AllowanceRule[]> {
    return this.allowancesService.getAllowanceRulesForChild(childId, user);
  }

  /*
   * Mutation createAllowanceRule : un parent crée un virement récurrent.
   *
   * @UseGuards(RolesGuard) + @Roles(Role.PARENT) : seul un PARENT peut créer
   * un virement automatique. L'appartenance à la même famille est vérifiée
   * dans le service.
   *
   * @Args('amount') : montant crédité au solde à chaque exécution (positif).
   * @Args('frequency') : WEEKLY (toutes les 7 jours) ou MONTHLY (tous les 30 jours).
   *
   * Le nextRunAt est calculé automatiquement (maintenant + fréquence). Le cron
   * processDueAllowances traitera la règle quand nextRunAt <= NOW().
   */
  @Mutation(() => AllowanceRule)
  @UseGuards(RolesGuard)
  @Roles(Role.PARENT)
  async createAllowanceRule(
    @CurrentUser() creator: JwtPayload,
    @Args('childId', { type: () => ID }) childId: string,
    @Args('amount') amount: number,
    // type: () => AllowanceFrequency : typage explicite requis car reflect-metadata
    // infère String pour les args enum, ce qui génère `String!` au lieu de
    // `AllowanceFrequency!` dans le schéma GraphQL (même classe de bug que les ID).
    @Args('frequency', { type: () => AllowanceFrequency }) frequency: AllowanceFrequency,
  ): Promise<AllowanceRule> {
    return this.allowancesService.createAllowanceRule({
      childId,
      amount,
      frequency,
      creator,
    });
  }

  /*
   * Mutation updateAllowanceRule : un parent modifie un virement (édition
   * partielle).
   *
   * Schéma §6 : updateAllowanceRule(ruleId: ID!, amount: Float,
   *   frequency: AllowanceFrequency, active: Boolean): AllowanceRule!
   *
   * @UseGuards(RolesGuard) + @Roles(Role.PARENT) : seul un PARENT peut modifier
   * un virement. L'appartenance à la même famille est vérifiée dans le service.
   *
   * Les champs amount, frequency et active sont tous optionnels. Un changement
   * de frequency recalcule nextRunAt ; un changement de amount/active garde le
   * nextRunAt actuel (voir le service pour les détails).
   *
   * @Args('ruleId') ruleId : ID de la règle à modifier.
   * @Args('amount', { nullable: true }) : nouveau montant (optionnel).
   * @Args('frequency', { nullable: true }) : nouvelle fréquence (optionnel).
   * @Args('active', { nullable: true }) : activer/suspendre (optionnel).
   * @CurrentUser() user : payload JWT du parent.
   */
  @Mutation(() => AllowanceRule)
  @UseGuards(RolesGuard)
  @Roles(Role.PARENT)
  async updateAllowanceRule(
    @CurrentUser() user: JwtPayload,
    @Args('ruleId', { type: () => ID }) ruleId: string,
    @Args('amount', { nullable: true }) amount?: number,
    @Args('frequency', { type: () => AllowanceFrequency, nullable: true })
    frequency?: AllowanceFrequency,
    @Args('active', { nullable: true }) active?: boolean,
  ): Promise<AllowanceRule> {
    return this.allowancesService.updateAllowanceRule({
      ruleId,
      amount,
      frequency,
      active,
      requester: user,
    });
  }

  /*
   * Mutation deleteAllowanceRule : un parent supprime un virement.
   *
   * Schéma §6 : deleteAllowanceRule(ruleId: ID!): Boolean!
   *
   * @UseGuards(RolesGuard) + @Roles(Role.PARENT) : seul un PARENT peut supprimer
   * un virement. L'appartenance à la même famille est vérifiée dans le service.
   *
   * @Args('ruleId') ruleId : ID de la règle à supprimer.
   * @CurrentUser() user : payload JWT du parent.
   */
  @Mutation(() => Boolean)
  @UseGuards(RolesGuard)
  @Roles(Role.PARENT)
  async deleteAllowanceRule(
    @CurrentUser() user: JwtPayload,
    @Args('ruleId', { type: () => ID }) ruleId: string,
  ): Promise<boolean> {
    return this.allowancesService.deleteAllowanceRule({
      ruleId,
      requester: user,
    });
  }
}
