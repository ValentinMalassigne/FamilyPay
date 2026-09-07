import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
// ID : voir users.resolver.ts — typage explicite requis pour les args d'identifiant
// (childId, missionId ici) afin de générer `ID!` et non `String!` dans le schéma GraphQL.
import { UseGuards } from '@nestjs/common';
import { MissionsService } from './missions.service.js';
import { Mission, MissionStatus } from './entities/mission.entity.js';
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
 * - Mutation updateMission : un parent modifie une mission (PARENT only).
 * - Mutation deleteMission : un parent supprime une mission (PARENT only).
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
    @Args('childId', { type: () => ID }) childId: string,
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
    @Args('childId', { type: () => ID }) childId: string,
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
    @Args('missionId', { type: () => ID }) missionId: string,
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
    @Args('missionId', { type: () => ID }) missionId: string,
    @Args('approve') approve: boolean,
  ): Promise<Mission> {
    return this.missionsService.validateMission(missionId, approve, user);
  }

  /*
   * Mutation updateMission : un parent modifie une mission (édition partielle).
   *
   * Schéma §6 : updateMission(missionId: ID!, title: String, reward: Float,
   *   status: MissionStatus): Mission!
   *
   * @UseGuards(RolesGuard) + @Roles(Role.PARENT) : seul un PARENT peut modifier
   * une mission. L'appartenance à la même famille est vérifiée dans le service.
   *
   * Les champs title, reward et status sont tous optionnels : seuls les champs
   * fournis sont mis à jour. Le passage à VALIDATED crée la Transaction
   * MISSION_REWARD (voir le service pour les détails).
   *
   * @Args('missionId') missionId : ID de la mission à modifier.
   * @Args('title', { nullable: true }) : nouveau titre (optionnel).
   * @Args('reward', { nullable: true }) : nouvelle récompense (optionnel).
   * @Args('status', { nullable: true }) : nouveau statut (optionnel).
   * @CurrentUser() user : payload JWT du parent.
   */
  @Mutation(() => Mission)
  @UseGuards(RolesGuard)
  @Roles(Role.PARENT)
  async updateMission(
    @CurrentUser() user: JwtPayload,
    @Args('missionId', { type: () => ID }) missionId: string,
    @Args('title', { nullable: true }) title?: string,
    @Args('reward', { nullable: true }) reward?: number,
    @Args('status', { type: () => MissionStatus, nullable: true })
    status?: MissionStatus,
  ): Promise<Mission> {
    return this.missionsService.updateMission({
      missionId,
      title,
      reward,
      status,
      requester: user,
    });
  }

  /*
   * Mutation deleteMission : un parent supprime une mission.
   *
   * Schéma §6 : deleteMission(missionId: ID!): Boolean!
   *
   * @UseGuards(RolesGuard) + @Roles(Role.PARENT) : seul un PARENT peut supprimer
   * une mission. L'appartenance à la même famille est vérifiée dans le service.
   *
   * Aucune restriction de statut : la mission est supprimée quel que soit son
   * état. La Transaction MISSION_REWARD éventuelle reste (non reversible).
   *
   * @Args('missionId') missionId : ID de la mission à supprimer.
   * @CurrentUser() user : payload JWT du parent.
   */
  @Mutation(() => Boolean)
  @UseGuards(RolesGuard)
  @Roles(Role.PARENT)
  async deleteMission(
    @CurrentUser() user: JwtPayload,
    @Args('missionId', { type: () => ID }) missionId: string,
  ): Promise<boolean> {
    return this.missionsService.deleteMission({ missionId, requester: user });
  }
}
