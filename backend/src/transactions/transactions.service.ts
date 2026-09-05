import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PubSub } from 'graphql-subscriptions';
import { Transaction, TransactionType, CreatedBy } from './entities/transaction.entity.js';
import { ChildAccount } from '../users/entities/child-account.entity.js';
import { UsersService } from '../users/users.service.js';
import { Role } from '../users/entities/user.entity.js';
import type { JwtPayload } from '../common/types.js';

/*
 * TransactionsService : service contenant la logique métier autour des transactions.
 *
 * @Injectable() : NestJS peut injecter ce service dans les resolvers et autres
 * services. L'injection de dépendances est le cœur de NestJS.
 *
 * Dépendances injectées via le constructeur :
 * - transactionRepository : Repository<Transaction> de TypeORM, pour interroger
 *   la table "transaction".
 * - childAccountRepository : Repository<ChildAccount> pour mettre à jour le solde.
 * - usersService : UsersService pour vérifier l'appartenance famille et charger
 *   les utilisateurs.
 */
@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(ChildAccount)
    private childAccountRepository: Repository<ChildAccount>,
    private usersService: UsersService,
    @Inject('PUB_SUB') private pubSub: PubSub,
  ) {}

  /*
   * getTransactions : retourne l'historique des transactions pour un enfant.
   *
   * @param childId : ID de l'enfant (User avec role=CHILD).
   * @returns Promise<Transaction[]> : liste des transactions triées par createdAt DESC.
   *
   * Utilisé par le resolver transactions() pour la query GraphQL.
   */
  async getTransactions(childId: string): Promise<Transaction[]> {
    return this.transactionRepository.find({
      where: { childId },
      order: { createdAt: 'DESC' },
    });
  }

  /*
   * addTransaction : crée une nouvelle transaction et met à jour le solde du ChildAccount.
   *
   * @param params : objet contenant childId, amount, type, label, category, createdBy.
   * @returns Promise<Transaction> : la transaction créée.
   *
   * Logique :
   *  1. Charger le ChildAccount de l'enfant.
   *  2. Mettre à jour le solde (balance += amount).
   *     - amount positif = crédit (RECHARGE, ALLOWANCE...).
   *     - amount négatif = débit (EXPENSE, POT_WITHDRAWAL...).
   *  3. Créer et sauvegarder la Transaction.
   *  4. Retourner la transaction créée.
   *
   * @throws NotFoundException si le ChildAccount n'existe pas.
   *
   * Note : Cette méthode est utilisée par les resolvers (addManualExpense, rechargeChildAccount)
   * et sera aussi utilisée par d'autres services (ex: AllowanceService pour les virements
   * automatiques, MissionService pour les récompenses de mission).
   */
  async addTransaction(params: {
    childId: string;
    amount: number;
    type: TransactionType;
    label?: string;
    category?: string;
    createdBy: CreatedBy;
  }): Promise<Transaction> {
    // 1. Charger le ChildAccount (lié à userId = childId)
    const childAccount = await this.childAccountRepository.findOne({
      where: { userId: params.childId },
    });

    if (!childAccount) {
      throw new NotFoundException(
        `ChildAccount non trouvé pour l'utilisateur ${params.childId}`,
      );
    }

    // 2. Vérifier que le solde ne passe pas en négatif.
    // Règle métier (PROJECT_CONTEXT.md §4) : un solde négatif est formellement
    // interdit — on simule une carte bancaire pour ados, pas un découvert.
    // Les crédits (amount > 0 : RECHARGE, ALLOWANCE, MISSION_REWARD...) sont
    // toujours autorisés. Seuls les débits (amount < 0 : EXPENSE,
    // POT_WITHDRAWAL...) sont plafonnés au solde courant.
    const newBalance = childAccount.balance + params.amount;
    if (newBalance < 0) {
      throw new BadRequestException(
        `Solde insuffisant : le solde (${childAccount.balance}) ne peut pas passer en négatif`,
      );
    }

    // 3. Mettre à jour le solde
    childAccount.balance = newBalance;
    const updatedAccount = await this.childAccountRepository.save(childAccount);

    // 4. Créer la transaction
    const transaction = this.transactionRepository.create({
      childId: params.childId,
      amount: params.amount,
      type: params.type,
      label: params.label,
      category: params.category,
      createdBy: params.createdBy,
    });

    // 5. Sauvegarder la transaction
    const savedTransaction = await this.transactionRepository.save(transaction);

    // 6. Publier l'événement pour la subscription balanceUpdated
    // L'événement est publié avec le childId comme clé pour filtrer les abonnements.
    this.pubSub.publish(`BALANCE_UPDATED_${params.childId}`, {
      balanceUpdated: updatedAccount,
    });

    // 7. Retourner la transaction
    return savedTransaction;
  }

  /*
   * addManualExpense : crée une transaction de type EXPENSE (dépense manuelle).
   *
   * @param params : objet contenant childId, amount (positif), label, category, creator.
   * @returns Promise<Transaction> : la transaction créée.
   *
   * Logique :
   *  - Le montant est converti en négatif (car une dépense = débit).
   *  - createdBy est déterminé par le rôle de l'appelant (CHILD ou PARENT).
   *
   * @throws ForbiddenException si l'utilisateur n'a pas le droit d'ajouter une dépense
   * pour cet enfant (ex: parent d'une autre famille).
   */
  async addManualExpense(params: {
    childId: string;
    amount: number; // Montant positif (ex: 10 pour une dépense de 10€)
    label: string;
    category?: string;
    creator: JwtPayload;
  }): Promise<Transaction> {
    // Vérifier que l'utilisateur (parent ou enfant) a le droit d'ajouter une dépense
    // pour cet enfant (même famille).
    const child = await this.usersService.findById(params.childId);
    if (!child) {
      throw new NotFoundException(`Utilisateur enfant non trouvé`);
    }

    // Un parent peut ajouter une dépense pour n'importe quel enfant de SA famille.
    // Un enfant peut ajouter une dépense UNIQUEMENT pour lui-même.
    const isSameFamily = child.familyId === params.creator.familyId;
    const isChildItself = params.creator.sub === params.childId;
    const isParent = params.creator.role === Role.PARENT;

    if (!isSameFamily) {
      throw new ForbiddenException(
        `Vous n'avez pas le droit d'ajouter une dépense pour cet enfant`,
      );
    }

    if (!isChildItself && !isParent) {
      throw new ForbiddenException(
        `Seul un parent ou l'enfant lui-même peut ajouter une dépense`,
      );
    }

    // Déterminer createdBy
    const createdBy = isChildItself ? CreatedBy.CHILD : CreatedBy.PARENT;

    return this.addTransaction({
      childId: params.childId,
      amount: -Math.abs(params.amount), // Convertir en négatif pour une dépense
      type: TransactionType.EXPENSE,
      label: params.label,
      category: params.category,
      createdBy,
    });
  }

  /*
   * rechargeChildAccount : crée une transaction de type RECHARGE (recharge manuelle par un parent).
   *
   * @param params : objet contenant childId, amount (positif), creator.
   * @returns Promise<Transaction> : la transaction créée.
   *
   * Logique :
   *  - Seuls les parents peuvent recharger un compte enfant.
   *  - Le montant est positif (crédit).
   *  - Vérification que l'enfant fait partie de la même famille que le parent.
   *
   * @throws ForbiddenException si l'utilisateur n'est pas un parent ou si l'enfant
   * n'est pas dans sa famille.
   */
  async rechargeChildAccount(params: {
    childId: string;
    amount: number; // Montant positif (ex: 20 pour une recharge de 20€)
    creator: JwtPayload;
  }): Promise<Transaction> {
    // Vérifier que l'appelant est un parent
    if (params.creator.role !== Role.PARENT) {
      throw new ForbiddenException(
        `Seul un parent peut recharger un compte enfant`,
      );
    }

    // Vérifier que l'enfant existe et fait partie de la même famille
    const child = await this.usersService.findById(params.childId);
    if (!child) {
      throw new NotFoundException(`Utilisateur enfant non trouvé`);
    }

    if (child.familyId !== params.creator.familyId) {
      throw new ForbiddenException(
        `Vous n'avez pas le droit de recharger le compte de cet enfant`,
      );
    }

    return this.addTransaction({
      childId: params.childId,
      amount: Math.abs(params.amount), // Montant positif pour une recharge
      type: TransactionType.RECHARGE,
      label: `Recharge par ${params.creator.firstName} ${params.creator.lastName}`,
      createdBy: CreatedBy.PARENT,
    });
  }
}
