import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Pot, WithdrawalPolicy } from './entities/pot.entity.js';
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
   *  - Le montant est plafonné à targetAmount - currentAmount (pas de
   *    dépassement de l'objectif).
   *  - On crée une PotContribution (isPublicDonation = true).
   *  - On crée une Transaction de type POT_CONTRIBUTION sur le compte de
   *    l'enfant (crédit, amount positif) via TransactionsService.addTransaction,
   *    ce qui met à jour le solde et publie l'événement balanceUpdated.
   *  - On met à jour currentAmount du pot.
   *
   * @throws BadRequestException si amount <= 0 ou si le montant dépasse la
   *         place restante dans la cagnotte.
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

    // Plafond : pas de dépassement de l'objectif de la cagnotte.
    const remaining = pot.targetAmount - pot.currentAmount;
    if (params.amount > remaining) {
      throw new BadRequestException(
        `Le montant dépasse la place restante (${remaining}€ disponibles)`,
      );
    }

    // Créer la Transaction POT_CONTRIBUTION (crédit vers le solde de l'enfant).
    // addTransaction met à jour le solde (balance += amount) et publie
    // l'événement balanceUpdated pour la subscription temps réel.
    await this.transactionsService.addTransaction({
      childId: pot.childId,
      amount: params.amount,
      type: TransactionType.POT_CONTRIBUTION,
      label: `Contribution cagnotte « ${pot.title} »`,
      createdBy: CreatedBy.SYSTEM,
    });

    // Mettre à jour currentAmount du pot.
    pot.currentAmount += params.amount;
    await this.potRepository.save(pot);

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
   * Le retrait :
   *  1. Vérifie que amount > 0 et amount <= currentAmount (on ne retire pas
   *     plus que ce que la cagnotte contient).
   *  2. Vérifie la policy si l'appelant est un enfant.
   *  3. Diminue currentAmount du pot.
   *  4. Crée une Transaction POT_WITHDRAWAL (débit, amount négatif) via
   *     TransactionsService.addTransaction, ce qui met à jour le solde
   *     (balance -= amount) et publie balanceUpdated.
   *
   * @returns la Transaction créée (le schéma §6 spécifie withdrawFromPot: Transaction!).
   *
   * @throws ForbiddenException si l'enfant n'est pas autorisé par la policy.
   * @throws BadRequestException si amount <= 0 ou > currentAmount.
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

    if (params.amount > pot.currentAmount) {
      throw new BadRequestException(
        `Montant supérieur au contenu de la cagnotte (${pot.currentAmount}€)`,
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

    // Diminuer currentAmount du pot.
    pot.currentAmount -= params.amount;
    await this.potRepository.save(pot);

    // Créer la Transaction POT_WITHDRAWAL (débit sur le solde).
    // addTransaction vérifie que le solde ne passe pas négatif et publie
    // l'événement balanceUpdated. On retourne la Transaction créée (schéma §6).
    const transaction = await this.transactionsService.addTransaction({
      childId: pot.childId,
      amount: -params.amount,
      type: TransactionType.POT_WITHDRAWAL,
      label: `Retrait cagnotte « ${pot.title} »`,
      createdBy: isParent ? CreatedBy.PARENT : CreatedBy.CHILD,
    });

    return transaction;
  }
}
