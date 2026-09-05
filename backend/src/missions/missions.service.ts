import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mission, MissionStatus } from './entities/mission.entity.js';
import { TransactionsService } from '../transactions/transactions.service.js';
import { UsersService } from '../users/users.service.js';
import { TransactionType, CreatedBy } from '../transactions/entities/transaction.entity.js';
import { Role } from '../users/entities/user.entity.js';
import type { JwtPayload } from '../common/types.js';

/*
 * MissionsService : logique métier du cycle de vie des missions.
 *
 * Flux (PROJECT_CONTEXT.md §4) :
 *   PENDING → DONE_BY_CHILD → VALIDATED (crée Transaction MISSION_REWARD)
 *                              ou REJECTED
 *
 * Dépendances injectées :
 * - missionRepository : Repository<Mission>, pour interroger la table "mission".
 * - transactionsService : pour créer la Transaction MISSION_REWARD quand une
 *   mission est validée (crédit de la récompense vers le solde de l'enfant).
 * - usersService : pour vérifier l'appartenance famille (un parent ne crée
 *   des missions que pour les enfants de SA famille).
 */
@Injectable()
export class MissionsService {
  constructor(
    @InjectRepository(Mission)
    private missionRepository: Repository<Mission>,
    private transactionsService: TransactionsService,
    private usersService: UsersService,
  ) {}

  /*
   * createMission : un parent crée une mission pour un de ses enfants.
   *
   * @throws NotFoundException si l'enfant n'existe pas.
   * @throws ForbiddenException si l'enfant n'est pas dans la famille du parent.
   * @throws BadRequestException si reward <= 0.
   */
  async createMission(params: {
    childId: string;
    title: string;
    reward: number;
    creator: JwtPayload;
  }): Promise<Mission> {
    const child = await this.usersService.findById(params.childId);
    if (!child) {
      throw new NotFoundException('Enfant non trouvé');
    }
    if (child.familyId !== params.creator.familyId) {
      throw new ForbiddenException(
        "Vous n'avez pas le droit de créer une mission pour cet enfant",
      );
    }

    if (params.reward <= 0) {
      throw new BadRequestException('La récompense doit être positive');
    }

    const mission = this.missionRepository.create({
      childId: params.childId,
      createdByParentId: params.creator.sub,
      title: params.title,
      description: null,
      reward: params.reward,
      status: MissionStatus.PENDING,
      completedAt: null,
      validatedAt: null,
    });
    return this.missionRepository.save(mission);
  }

  /*
   * getMissionsForChild : retourne les missions d'un enfant.
   *
   * Un parent peut voir les missions des enfants de SA famille.
   * Un enfant ne voit que SES propres missions.
   *
   * @throws ForbiddenException si l'appelant n'y a pas droit.
   */
  async getMissionsForChild(childId: string, requester: JwtPayload): Promise<Mission[]> {
    const isChildItself = requester.sub === childId;
    const isParent = requester.role === Role.PARENT;

    if (!isChildItself && !isParent) {
      throw new ForbiddenException(
        "Vous n'avez pas accès aux missions de cet enfant",
      );
    }

    if (isParent && !isChildItself) {
      const child = await this.usersService.findById(childId);
      if (!child || child.familyId !== requester.familyId) {
        throw new ForbiddenException(
          "Vous n'avez pas accès aux missions de cet enfant",
        );
      }
    }

    return this.missionRepository.find({
      where: { childId },
      order: { createdAt: 'DESC' },
    });
  }

  /*
   * markMissionDone : l'enfant marque une mission comme faite.
   *
   * Transition : PENDING → DONE_BY_CHILD.
   *
   * Règle : seul l'enfant à qui la mission est assignée peut la marquer faite.
   * Un parent ne peut pas (il doit utiliser validateMission).
   *
   * @throws ForbiddenException si l'appelant n'est pas l'enfant propriétaire.
   * @throws BadRequestException si la mission n'est pas en statut PENDING.
   */
  async markMissionDone(missionId: string, requester: JwtPayload): Promise<Mission> {
    const mission = await this.missionRepository.findOne({
      where: { id: missionId },
    });
    if (!mission) {
      throw new NotFoundException('Mission non trouvée');
    }

    // Seul l'enfant à qui la mission est assignée peut la marquer faite.
    if (requester.sub !== mission.childId) {
      throw new ForbiddenException(
        'Seul l\'enfant concerné peut marquer cette mission comme faite',
      );
    }

    if (mission.status !== MissionStatus.PENDING) {
      throw new BadRequestException(
        `La mission doit être en statut PENDING (actuel: ${mission.status})`,
      );
    }

    mission.status = MissionStatus.DONE_BY_CHILD;
    mission.completedAt = new Date();
    return this.missionRepository.save(mission);
  }

  /*
   * validateMission : un parent valide ou refuse une mission marquée faite.
   *
   * Transition : DONE_BY_CHILD → VALIDATED (approve=true) ou REJECTED (approve=false).
   *
   * Si approve=true :
   *  - Statut → VALIDATED.
   *  - Crée une Transaction MISSION_REWARD (crédit de reward vers le solde
   *    de l'enfant) via TransactionsService.addTransaction.
   *  - Met à jour validatedAt.
   *
   * Si approve=false :
   *  - Statut → REJECTED.
   *  - Pas de Transaction (pas de récompense).
   *  - Met à jour validatedAt.
   *
   * @throws ForbiddenException si l'appelant n'est pas un parent de la même
   *         famille que l'enfant.
   * @throws BadRequestException si la mission n'est pas en statut DONE_BY_CHILD.
   */
  async validateMission(
    missionId: string,
    approve: boolean,
    requester: JwtPayload,
  ): Promise<Mission> {
    const mission = await this.missionRepository.findOne({
      where: { id: missionId },
    });
    if (!mission) {
      throw new NotFoundException('Mission non trouvée');
    }

    // Seul un parent peut valider/refuser une mission.
    if (requester.role !== Role.PARENT) {
      throw new ForbiddenException(
        'Seul un parent peut valider ou refuser une mission',
      );
    }

    // Vérifier que l'enfant fait partie de la famille du parent.
    const child = await this.usersService.findById(mission.childId);
    if (!child || child.familyId !== requester.familyId) {
      throw new ForbiddenException(
        "Vous n'avez pas le droit de valider cette mission",
      );
    }

    // La mission doit avoir été marquée faite par l'enfant au préalable.
    if (mission.status !== MissionStatus.DONE_BY_CHILD) {
      throw new BadRequestException(
        `La mission doit être en statut DONE_BY_CHILD (actuel: ${mission.status})`,
      );
    }

    mission.validatedAt = new Date();

    if (approve) {
      mission.status = MissionStatus.VALIDATED;
      await this.missionRepository.save(mission);

      // Créditer la récompense vers le solde de l'enfant.
      // addTransaction met à jour le balance (crédit) et publie l'événement
      // balanceUpdated pour la subscription temps réel.
      await this.transactionsService.addTransaction({
        childId: mission.childId,
        amount: mission.reward,
        type: TransactionType.MISSION_REWARD,
        label: `Récompense mission « ${mission.title} »`,
        createdBy: CreatedBy.PARENT,
      });
    } else {
      mission.status = MissionStatus.REJECTED;
      await this.missionRepository.save(mission);
    }

    return mission;
  }
}
