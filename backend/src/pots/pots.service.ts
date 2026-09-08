import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { PubSub } from 'graphql-subscriptions';
import { Pot, WithdrawalPolicy, PotStatus } from './entities/pot.entity.js';
import { PotContribution } from './entities/pot-contribution.entity.js';
import { TransactionsService } from '../transactions/transactions.service.js';
import { UsersService } from '../users/users.service.js';
import { TransactionType, CreatedBy, Transaction } from '../transactions/entities/transaction.entity.js';
import { Role } from '../users/entities/user.entity.js';
import type { JwtPayload } from '../common/types.js';

/*
 * PotsService : service contenant la logique métier autour des cagnottes (Pot).
 *
 * @Injectable() : NestJS peut injecter ce service dans le resolver.
 *
 * Dépendances injectées via le constructeur :
 * - potRepository : Repository<Pot> de TypeORM, pour interroger la table "pot".
 * - potContributionRepository : Repository<PotContribution>, pour enregistrer
 *   chaque contribution (don public ou interne).
 * - transactionsService : TransactionsService, pour créer les transactions
 *   POT_CONTRIBUTION (crédit) et POT_WITHDRAWAL (débit) liées aux cagnottes.
 *   On délègue la mise à jour du solde et la publication de la subscription
 *   balanceUpdated à ce service, qui centralise déjà cette logique.
 * - usersService : UsersService, pour vérifier l'appartenance famille d'un
 *   enfant (un parent ne crée/voit des cagnottes que pour les enfants de SA
 *   famille).
 */
@Injectable()
export class PotsService {
  constructor(
    @InjectRepository(Pot)
    private potRepository: Repository<Pot>,
    @InjectRepository(PotContribution)
    private potContributionRepository: Repository<PotContribution>,
    private transactionsService: TransactionsService,
    private usersService: UsersService,
    // PubSub injecté via le token 'PUB_SUB' (PubSubModule @Global). Utilisé
    // pour publier l'événement potUpdated quand un don public arrive sur une
    // cagnotte, afin que l'app enfant soit notifiée en temps réel.
    @Inject('PUB_SUB') private pubSub: PubSub,
  ) {}

  /*
   * createPot : un parent crée une cagnotte d'épargne pour un de ses enfants.
   *
   * Règles métier (PROJECT_CONTEXT.md §4) :
   *  - Seul un PARENT peut créer une cagnotte (vérifié par @Roles dans le
   *    resolver, mais on vérifie aussi ici la cohérence famille).
   *  - L'enfant doit appartenir à la même famille que le parent créateur.
   *  - targetAmount doit être positif.
   *  - publicToken est généré automatiquement (crypto.randomUUID) pour le
   *    lien de don public.
   *  - currentAmount démarre à 0, hiddenFrom à [] (vide = visible par tous).
   *
   * @throws NotFoundException si l'enfant n'existe pas.
   * @throws ForbiddenException si l'enfant n'est pas dans la famille du parent.
   * @throws BadRequestException si targetAmount <= 0.
   */
  async createPot(params: {
    childId: string;
    title: string;
    targetAmount: number;
    withdrawalPolicy: WithdrawalPolicy;
    creator: JwtPayload;
  }): Promise<Pot> {
    // Vérifier que l'enfant existe et fait partie de la même famille.
    const child = await this.usersService.findById(params.childId);
    if (!child) {
      throw new NotFoundException('Enfant non trouvé');
    }
    if (child.familyId !== params.creator.familyId) {
      throw new ForbiddenException(
        "Vous n'avez pas le droit de créer une cagnotte pour cet enfant",
      );
    }

    if (params.targetAmount <= 0) {
      throw new BadRequestException('Le montant objectif doit être positif');
    }

    const pot = this.potRepository.create({
      childId: params.childId,
      title: params.title,
      targetAmount: params.targetAmount,
      currentAmount: 0,
      publicToken: randomUUID(),
      hiddenFrom: [],
      withdrawalPolicy: params.withdrawalPolicy,
    });
    return this.potRepository.save(pot);
  }

  /*
   * getPotsForChild : retourne les cagnottes d'un enfant visibles par
   * l'appelant (parent ou l'enfant lui-même).
   *
   * Règle hiddenFrom (PROJECT_CONTEXT.md §4) :
   *  - Une cagnotte est toujours visible par l'enfant propriétaire.
   *  - hiddenFrom liste les userId de parents à qui la cagnotte est masquée.
   *    Si l'appelant est un parent présent dans hiddenFrom, la cagnotte est
   *    filtrée (non retournée).
   *
   * @throws ForbiddenException si l'appelant n'est ni l'enfant lui-même ni un
   *         parent de la même famille.
   */
  async getPotsForChild(childId: string, requester: JwtPayload): Promise<Pot[]> {
    // Un parent peut voir les cagnottes des enfants de SA famille.
    // Un enfant ne voit que SES propres cagnottes.
    const isChildItself = requester.sub === childId;
    const isParent = requester.role === Role.PARENT;

    if (!isChildItself && !isParent) {
      throw new ForbiddenException(
        "Vous n'avez pas accès aux cagnottes de cet enfant",
      );
    }

    if (isParent && !isChildItself) {
      const child = await this.usersService.findById(childId);
      if (!child || child.familyId !== requester.familyId) {
        throw new ForbiddenException(
          "Vous n'avez pas accès aux cagnottes de cet enfant",
        );
      }
    }

    const pots = await this.potRepository.find({ where: { childId } });

    // Filtrer les cagnottes masquées au parent appelant (hiddenFrom).
    // L'enfant propriétaire voit tout, on ne filtre pas pour lui.
    if (isParent && !isChildItself) {
      return pots.filter((pot) => !pot.hiddenFrom.includes(requester.sub));
    }
    return pots;
  }

  /*
   * getPotByPublicToken : récupère une cagnotte par son token public.
   *
   * Utilisé par contributeToPotPublic (mutation sans auth) : le donateur
   * fournit le publicToken de l'URL, on charge la cagnotte correspondante.
   *
   * @throws NotFoundException si aucune cagnotte ne correspond au token.
   */
  async getPotByPublicToken(publicToken: string): Promise<Pot> {
    const pot = await this.potRepository.findOne({ where: { publicToken } });
    if (!pot) {
      throw new NotFoundException('Cagnotte non trouvée');
    }
    return pot;
  }

  /*
   * contributeToPotPublic : contribution publique à une cagnotte (sans auth).
   *
   * C'est la SEULE mutation sans JWT (PROJECT_CONTEXT.md §8). Le resolver est
   * marqué @Public() pour exclure le GqlAuthGuard global.
   *
   * Règles métier (PROJECT_CONTEXT.md §4) :
   *  - Le montant doit être positif.
   *  - La cagnotte doit être OPEN (status) — une cagnotte CLOSED n'accepte plus
   *    aucune contribution, même publique.
   *  - Le montant est plafonné à targetAmount - currentAmount (pas de
   *    dépassement de l'objectif).
   *  - On crée une PotContribution (isPublicDonation = true).
   *  - On met à jour currentAmount du pot.
   *
   * IMPORTANT : une cagnotte est un solde SÉPARÉ du solde principal de l'enfant.
   * La contribution ne crée PAS de Transaction sur le compte principal — elle
   * ne fait qu'augmenter pot.currentAmount et enregistrer la PotContribution.
   * L'argent n'est transféré vers le solde principal qu'au moment du retrait
   * (voir withdrawFromPot).
   *
   * @throws BadRequestException si amount <= 0, si la cagnotte est clôturée,
   *         ou si le montant dépasse la place restante dans la cagnotte.
   */
  async contributeToPotPublic(params: {
    publicToken: string;
    amount: number;
    contributorName?: string;
  }): Promise<PotContribution> {
    if (params.amount <= 0) {
      throw new BadRequestException('Le montant doit être positif');
    }

    const pot = await this.getPotByPublicToken(params.publicToken);

    // Une cagnotte clôturée n'accepte plus de contributions.
    if (pot.status === PotStatus.CLOSED) {
      throw new BadRequestException(
        'Cagnotte clôturée, plus de contributions possibles',
      );
    }

    // Plafond : pas de dépassement de l'objectif de la cagnotte.
    const remaining = pot.targetAmount - pot.currentAmount;
    if (params.amount > remaining) {
      throw new BadRequestException(
        `Le montant dépasse la place restante (${remaining}€ disponibles)`,
      );
    }

    // La cagnotte est un solde séparé : on ne crée PAS de Transaction sur le
    // solde principal. On se contente d'augmenter currentAmount du pot.
    pot.currentAmount += params.amount;
    await this.potRepository.save(pot);

    // Publier l'événement POT_UPDATED pour la subscription GraphQL du même nom.
    // Une contribution publique ne crée pas de Transaction (donc pas de
    // balanceUpdated/transactionAdded) : c'est le seul moyen pour l'app enfant
    // de savoir qu'un don est arrivé sur sa cagnotte. Le topic inclut le childId
    // pour le filtrage côté subscription. On ne publie QUE ici (pas dans
    // withdrawFromPot) : le retrait déclenche déjà balanceUpdated +
    // transactionAdded via addTransaction, donc un potUpdated supplémentaire
    // serait redondant pour l'enfant.
    this.pubSub.publish(`POT_UPDATED_${pot.childId}`, {
      potUpdated: pot,
    });

    // Créer l'enregistrement PotContribution.
    const contribution = this.potContributionRepository.create({
      potId: pot.id,
      amount: params.amount,
      contributorName: params.contributorName ?? null,
      isPublicDonation: true,
    });
    return this.potContributionRepository.save(contribution);
  }

  /*
   * withdrawFromPot : retire de l'argent d'une cagnotte vers le solde principal.
   *
   * Règle métier — withdrawalPolicy (PROJECT_CONTEXT.md §4) :
   *  - ANYTIME     : l'enfant peut retirer librement.
   *  - WHEN_FULL   : l'enfant ne peut retirer que si currentAmount >= targetAmount.
   *  - PARENT_ONLY : l'enfant ne peut JAMAIS retirer lui-même.
   *  - Un PARENT peut TOUJOURS retirer, quelle que soit la policy.
   *
   * Le guard (ici, dans le service) distingue l'appelant :
   *  - parent → toujours autorisé.
   *  - enfant → vérifier la policy.
   *
   * Règle métier — retrait total + clôture automatique (PROJECT_CONTEXT.md §4) :
   *  - Une cagnotte se vide en une seule fois : amount doit valoir exactement
   *    currentAmount (pas de retrait partiel, pas d'argent bloqué).
   *  - L'argent quitte la cagnotte pour ENTRER dans le solde principal : la
   *    Transaction POT_WITHDRAWAL est un CRÉDIT (amount positif), pas un débit.
   *  - Après le retrait, la cagnotte est CLÔTURÉE (status → CLOSED) : plus
   *    aucune contribution n'est acceptée (enfant, parent ou don public).
   *  - currentAmount retombe à 0.
   *
   * Le retrait :
   *  1. Vérifie que la cagnotte n'est pas déjà CLOSED.
   *  2. Vérifie que amount > 0 et amount === currentAmount (retrait total).
   *  3. Vérifie la policy si l'appelant est un enfant.
   *  4. Met currentAmount à 0 et status à CLOSED.
   *  5. Crée une Transaction POT_WITHDRAWAL (crédit, amount positif) via
   *     TransactionsService.addTransaction, ce qui met à jour le solde
   *     (balance += amount) et publie balanceUpdated.
   *
   * @returns la Transaction créée (le schéma §6 spécifie withdrawFromPot: Transaction!).
   *
   * @throws BadRequestException si la cagnotte est déjà clôturée, si amount <= 0
   *         ou si amount != currentAmount (retrait partiel interdit).
   * @throws ForbiddenException si l'enfant n'est pas autorisé par la policy.
   */
  async withdrawFromPot(params: {
    potId: string;
    amount: number;
    requester: JwtPayload;
  }): Promise<Transaction> {
    if (params.amount <= 0) {
      throw new BadRequestException('Le montant doit être positif');
    }

    const pot = await this.potRepository.findOne({
      where: { id: params.potId },
    });
    if (!pot) {
      throw new NotFoundException('Cagnotte non trouvée');
    }

    // Une cagnotte déjà clôturée ne peut plus faire l'objet d'un retrait.
    if (pot.status === PotStatus.CLOSED) {
      throw new BadRequestException('Cagnotte déjà clôturée');
    }

    // Retrait total obligatoire : une cagnotte se vide en une fois.
    if (params.amount !== pot.currentAmount) {
      throw new BadRequestException(
        `Le retrait doit être total (${pot.currentAmount}€ disponibles)`,
      );
    }

    const isParent = params.requester.role === Role.PARENT;
    const isChildItself = params.requester.sub === pot.childId;

    // Vérifier l'appartenance : seul l'enfant propriétaire ou un parent de
    // la même famille peut retirer.
    if (!isChildItself && !isParent) {
      throw new ForbiddenException(
        "Vous n'avez pas le droit de retirer de cette cagnotte",
      );
    }

    if (isParent && !isChildItself) {
      const child = await this.usersService.findById(pot.childId);
      if (!child || child.familyId !== params.requester.familyId) {
        throw new ForbiddenException(
          "Vous n'avez pas le droit de retirer de cette cagnotte",
        );
      }
    }

    // Vérifier la policy si l'appelant est l'enfant (un parent passe toujours).
    if (isChildItself && !isParent) {
      if (pot.withdrawalPolicy === WithdrawalPolicy.PARENT_ONLY) {
        throw new ForbiddenException(
          'Seul un parent peut retirer de cette cagnotte (policy PARENT_ONLY)',
        );
      }
      if (
        pot.withdrawalPolicy === WithdrawalPolicy.WHEN_FULL &&
        pot.currentAmount < pot.targetAmount
      ) {
        throw new ForbiddenException(
          'Retrait impossible : la cagnotte doit être pleine (policy WHEN_FULL)',
        );
      }
    }

    // Vider la cagnotte et la clôturer. Le currentAmount retombe à 0 (plus
    // d'argent bloqué) et le status passe à CLOSED (plus de contribution).
    pot.currentAmount = 0;
    pot.status = PotStatus.CLOSED;
    await this.potRepository.save(pot);

    // Créer la Transaction POT_WITHDRAWAL : l'argent quitte la cagnotte pour
    // ENTRER dans le solde principal, donc c'est un CRÉDIT (amount positif).
    // addTransaction met à jour le solde (balance += amount) et publie
    // l'événement balanceUpdated. On retourne la Transaction créée (schéma §6).
    const transaction = await this.transactionsService.addTransaction({
      childId: pot.childId,
      amount: params.amount,
      type: TransactionType.POT_WITHDRAWAL,
      label: `Retrait cagnotte « ${pot.title} »`,
      createdBy: isParent ? CreatedBy.PARENT : CreatedBy.CHILD,
    });

    return transaction;
  }

  /*
   * updatePot : un parent modifie une cagnotte existante.
   *
   * Règles métier (décisions de design) :
   *  - Seule une cagnotte OPEN est éditable. Une cagnotte CLOSED (après retrait)
   *    n'est plus modifiable — on ne peut que la supprimer si elle est vide.
   *  - title, si fourni, doit être non vide.
   *  - targetAmount, si fourni, doit être > 0 et >= currentAmount (on ne peut
   *    pas baisser l'objectif sous le montant déjà accumulé).
   *  - withdrawalPolicy, si fourni, est déjà validé par l'enum GraphQL.
   *  - Les champs non fournis (undefined) ne sont pas modifiés (édition
   *    partielle).
   *
   * @throws NotFoundException si la cagnotte n'existe pas.
   * @throws ForbiddenException si la cagnotte n'appartient pas à la famille
   *         du parent.
   * @throws BadRequestException si la cagnotte est CLOSED, si title est vide,
   *         ou si targetAmount est invalide.
   */
  async updatePot(params: {
    potId: string;
    title?: string;
    targetAmount?: number;
    withdrawalPolicy?: WithdrawalPolicy;
    requester: JwtPayload;
  }): Promise<Pot> {
    const pot = await this.potRepository.findOne({
      where: { id: params.potId },
    });
    if (!pot) {
      throw new NotFoundException('Cagnotte non trouvée');
    }

    // Vérifier l'appartenance famille : on charge l'enfant propriétaire et on
    // compare son familyId à celui du parent appelant (même pattern que
    // createPot / withdrawFromPot).
    const child = await this.usersService.findById(pot.childId);
    if (!child || child.familyId !== params.requester.familyId) {
      throw new ForbiddenException(
        "Vous n'avez pas le droit de modifier cette cagnotte",
      );
    }

    // Une cagnotte clôturée n'est plus éditable.
    if (pot.status === PotStatus.CLOSED) {
      throw new BadRequestException(
        'Une cagnotte clôturée ne peut plus être modifiée',
      );
    }

    if (params.title !== undefined && params.title.trim() === '') {
      throw new BadRequestException('Le titre ne peut pas être vide');
    }

    if (params.targetAmount !== undefined) {
      if (params.targetAmount <= 0) {
        throw new BadRequestException('Le montant objectif doit être positif');
      }
      // On ne peut pas baisser l'objectif sous le montant déjà accumulé.
      if (params.targetAmount < pot.currentAmount) {
        throw new BadRequestException(
          `L'objectif ne peut pas être inférieur au montant déjà accumulé (${pot.currentAmount}€)`,
        );
      }
    }

    // Appliquer uniquement les champs fournis (édition partielle).
    if (params.title !== undefined) pot.title = params.title.trim();
    if (params.targetAmount !== undefined) pot.targetAmount = params.targetAmount;
    if (params.withdrawalPolicy !== undefined) {
      pot.withdrawalPolicy = params.withdrawalPolicy;
    }

    return this.potRepository.save(pot);
  }

  /*
   * deletePot : un parent supprime une cagnotte.
   *
   * Règles métier (décisions de design) :
   *  - On ne peut pas supprimer une cagnotte qui contient de l'argent
   *    (currentAmount > 0 → BadRequestException). Le parent doit d'abord
   *    retirer l'argent (withdrawFromPot), ce qui vide la cagnotte et la
   *    clôture.
   *  - Une cagnotte vide (OPEN ou CLOSED) peut être supprimée.
   *  - Les PotContribution associées sont supprimées en cascade manuelle avant
   *    le pot (pas de cascade DB automatique sur la relation).
   *
   * @throws NotFoundException si la cagnotte n'existe pas.
   * @throws ForbiddenException si la cagnotte n'appartient pas à la famille.
   * @throws BadRequestException si currentAmount > 0.
   */
  async deletePot(params: {
    potId: string;
    requester: JwtPayload;
  }): Promise<boolean> {
    const pot = await this.potRepository.findOne({
      where: { id: params.potId },
    });
    if (!pot) {
      throw new NotFoundException('Cagnotte non trouvée');
    }

    const child = await this.usersService.findById(pot.childId);
    if (!child || child.familyId !== params.requester.familyId) {
      throw new ForbiddenException(
        "Vous n'avez pas le droit de supprimer cette cagnotte",
      );
    }

    // On ne peut pas supprimer une cagnotte qui contient encore de l'argent.
    if (pot.currentAmount > 0) {
      throw new BadRequestException(
        'Impossible de supprimer une cagnotte qui contient de l\'argent — retirez l\'argent d\'abord',
      );
    }

    // Cascade manuelle : supprimer d'abord les contributions associées, puis
    // le pot lui-même. On utilise delete() (par critère) plutôt que remove()
    // (par entité) pour éviter de charger chaque contribution.
    await this.potContributionRepository.delete({ potId: pot.id });
    await this.potRepository.delete({ id: pot.id });

    return true;
  }
}
