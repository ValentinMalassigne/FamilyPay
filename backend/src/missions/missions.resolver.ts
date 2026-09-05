import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { MissionsService } from './missions.service.js';
import { Mission } from './entities/mission.entity.js';
import { RolesGuard } from '../common/roles.guard.js';
import { Roles } from '../common/roles.decorator.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { Role } from '../users/entities/user.entity.js';
import type { JwtPayload } from '../common/types.js';

/*
 * MissionsResolver : resolvers GraphQL pour les missions.
 *
 * @Resolver(() => Mission) : déclare un resolver attaché au type Mission.
 *
 * Authentification : GqlAuthGuard (global via APP_GUARD) vérifie le JWT sur
 * toutes les méthodes. RolesGuard est appliqué ponctuellement via
 * @UseGuards(RolesGuard) + @Roles(Role.PARENT) pour les mutations restreintes.
 *
 * Resolvers définis :
 * - Query missions : liste les missions d'un enfant (parent ou enfant lui-même).
 * - Mutation createMission : un parent crée une mission (PARENT only).
 * - Mutation markMissionDone : l'enfant marque sa mission comme faite.
 * - Mutation validateMission : un parent valide (approve=true) ou refuse
 *   (approve=false) une mission marquée faite.
 */
@Resolver(() => Mission)
export class MissionsResolver {
  constructor(private missionsService: MissionsService) {}

  /*
   * Query missions : retourne les missions d'un enfant.
   *
   * Schéma §6 : missions(childId: ID!): [Mission!]!
   *
   * GqlAuthGuard (global) vérifie le JWT. Pas de @Roles : un parent OU
   * l'enfant lui-même peut consulter (le filtrage famille est géré dans le
   * service).
   */
  @Query(() => [Mission])
  async missions(
    @CurrentUser() user: JwtPayload,
    @Args('childId') childId: string,
  ): Promise<Mission[]> {
    return this.missionsService.getMissionsForChild(childId, user);
  }

  /*
   * Mutation createMission : un parent crée une mission pour un enfant.
   *
   * Schéma §6 : createMission(childId: ID!, title: String!, reward: Float!): Mission!
   *
   * @UseGuards(RolesGuard) + @Roles(Role.PARENT) : seul un PARENT peut créer
   * une mission. L'appartenance à la même famille est vérifiée dans le service.
   *
   * @Args('reward') : montant de la récompense (positif, crédité au solde de
   * l'enfant quand la mission est validée).
   */
  @Mutation(() => Mission)
  @UseGuards(RolesGuard)
  @Roles(Role.PARENT)
  async createMission(
    @CurrentUser() creator: JwtPayload,
    @Args('childId') childId: string,
    @Args('title') title: string,
    @Args('reward') reward: number,
  ): Promise<Mission> {
    return this.missionsService.createMission({
      childId,
      title,
      reward,
      creator,
    });
  }

  /*
   * Mutation markMissionDone : l'enfant marque une mission comme faite.
   *
   * Schéma §6 : markMissionDone(missionId: ID!): Mission!
   *
   * GqlAuthGuard (global) vérifie le JWT. Pas de @Roles : seul l'enfant à qui
   * la mission est assignée peut la marquer faite (vérifié dans le service en
   * comparant requester.sub et mission.childId). Un parent ne peut pas
   * marquer une mission comme faite — il doit utiliser validateMission.
   *
   * Transition : PENDING → DONE_BY_CHILD.
   */
  @Mutation(() => Mission)
  async markMissionDone(
    @CurrentUser() user: JwtPayload,
    @Args('missionId') missionId: string,
  ): Promise<Mission> {
    return this.missionsService.markMissionDone(missionId, user);
  }

  /*
   * Mutation validateMission : un parent valide ou refuse une mission.
   *
   * Schéma §6 : validateMission(missionId: ID!, approve: Boolean!): Mission!
   *
   * @UseGuards(RolesGuard) + @Roles(Role.PARENT) : seul un PARENT peut valider
   * ou refuser une mission. L'appartenance à la même famille est vérifiée dans
   * le service.
   *
   * @Args('approve') : true = valider (VALIDATED, crée Transaction MISSION_REWARD),
   * false = refuser (REJECTED, pas de récompense).
   *
   * Transition : DONE_BY_CHILD → VALIDATED ou REJECTED.
   */
  @Mutation(() => Mission)
  @UseGuards(RolesGuard)
  @Roles(Role.PARENT)
  async validateMission(
    @CurrentUser() user: JwtPayload,
    @Args('missionId') missionId: string,
    @Args('approve') approve: boolean,
  ): Promise<Mission> {
    return this.missionsService.validateMission(missionId, approve, user);
  }
}
