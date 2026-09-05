import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
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
    @Args('childId') childId: string,
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
    @Args('childId') childId: string,
    @Args('amount') amount: number,
    @Args('frequency') frequency: AllowanceFrequency,
  ): Promise<AllowanceRule> {
    return this.allowancesService.createAllowanceRule({
      childId,
      amount,
      frequency,
      creator,
    });
  }
}
