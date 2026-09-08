import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { AllowanceRule, AllowanceFrequency } from './entities/allowance-rule.entity.js';
import { TransactionsService } from '../transactions/transactions.service.js';
import { UsersService } from '../users/users.service.js';
import { TransactionType, CreatedBy } from '../transactions/entities/transaction.entity.js';
import { Role } from '../users/entities/user.entity.js';
import type { JwtPayload } from '../common/types.js';

/*
 * AllowancesService : logique métier des virements automatiques (AllowanceRule).
 *
 * Une AllowanceRule est un virement récurrent défini par un parent :
 *  - amount crédité au solde de l'enfant à chaque exécution.
 *  - frequency (WEEKLY / MONTHLY) détermine l'intervalle entre deux exécutions.
 *  - nextRunAt : date de la prochaine exécution. Le cron traite les règles
 *    dont nextRunAt <= NOW().
 *  - active : si false, le cron ignore la règle (suspendue par le parent).
 *
 * Dépendances injectées :
 * - allowanceRuleRepository : Repository<AllowanceRule>.
 * - transactionsService : pour créer la Transaction ALLOWANCE (crédit).
 * - usersService : pour vérifier l'appartenance famille (createAllowanceRule).
 */
@Injectable()
export class AllowancesService {
  private readonly logger = new Logger(AllowancesService.name);

  constructor(
    @InjectRepository(AllowanceRule)
    private allowanceRuleRepository: Repository<AllowanceRule>,
    private transactionsService: TransactionsService,
    private usersService: UsersService,
  ) {}

  /*
   * createAllowanceRule : un parent crée un virement automatique pour un enfant.
   *
   * Le nextRunAt initial est calculé à partir de maintenant + la fréquence
   * (WEEKLY = +7 jours, MONTHLY = +30 jours). La première exécution aura lieu
   * au prochain cycle du cron après cette date.
   *
   * @throws NotFoundException si l'enfant n'existe pas.
   * @throws ForbiddenException si l'enfant n'est pas dans la famille du parent.
   * @throws BadRequestException si amount <= 0.
   */
  async createAllowanceRule(params: {
    childId: string;
    amount: number;
    frequency: AllowanceFrequency;
    creator: JwtPayload;
  }): Promise<AllowanceRule> {
    const child = await this.usersService.findById(params.childId);
    if (!child) {
      throw new NotFoundException('Enfant non trouvé');
    }
    if (child.familyId !== params.creator.familyId) {
      throw new ForbiddenException(
        "Vous n'avez pas le droit de créer un virement pour cet enfant",
      );
    }

    if (params.amount <= 0) {
      throw new BadRequestException('Le montant doit être positif');
    }

    // nextRunAt initial = maintenant + durée de la fréquence.
    const nextRunAt = new Date();
    const days = params.frequency === AllowanceFrequency.WEEKLY ? 7 : 30;
    nextRunAt.setDate(nextRunAt.getDate() + days);

    const rule = this.allowanceRuleRepository.create({
      childId: params.childId,
      amount: params.amount,
      frequency: params.frequency,
      nextRunAt,
      active: true,
    });
    return this.allowanceRuleRepository.save(rule);
  }

  /*
   * getAllowanceRulesForChild : retourne les règles de virement d'un enfant.
   *
   * Un parent voit les règles des enfants de SA famille.
   * Un enfant voit SES propres règles.
   *
   * @throws ForbiddenException si l'appelant n'y a pas droit.
   */
  async getAllowanceRulesForChild(childId: string, requester: JwtPayload): Promise<AllowanceRule[]> {
    const isChildItself = requester.sub === childId;
    const isParent = requester.role === Role.PARENT;

    if (!isChildItself && !isParent) {
      throw new ForbiddenException(
        "Vous n'avez pas accès aux virements de cet enfant",
      );
    }

    if (isParent && !isChildItself) {
      const child = await this.usersService.findById(childId);
      if (!child || child.familyId !== requester.familyId) {
        throw new ForbiddenException(
          "Vous n'avez pas accès aux virements de cet enfant",
        );
      }
    }

    return this.allowanceRuleRepository.find({ where: { childId } });
  }

  /*
   * processDueAllowances : cron exécuté toutes les minutes.
   *
   * @Cron(CronExpression.EVERY_MINUTE) : @nestjs/schedule déclenche cette
   * méthode automatiquement chaque minute. Le décorateur @Cron fait partie
   * de @nestjs/schedule et nécessite que ScheduleModule.forRoot() soit
   * enregistré dans AppModule.
   *
   * Logique (PROJECT_CONTEXT.md §4) :
   *  1. Trouver toutes les AllowanceRule actives dont nextRunAt <= NOW().
   *     Utilisation du opérateur TypeORM LessThan (génère `nextRunAt <= NOW()`).
   *  2. Pour chaque règle :
   *     a. Créer une Transaction ALLOWANCE (crédit de amount vers le solde).
   *     b. Calculer le prochain nextRunAt (nextRunAt += frequency).
   *  3. Sauvegarder la règle avec le nouveau nextRunAt.
   *
   * Si la Transaction échoue (ex: solde négatif — ne devrait pas arriver pour
   * un crédit ALLOWANCE), on log l'erreur et on passe à la règle suivante
   * sans casser le cron. On ne met PAS à jour nextRunAt en cas d'échec pour
   * que le cron réessaie au prochain cycle.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processDueAllowances(): Promise<void> {
    const dueRules = await this.allowanceRuleRepository.find({
      where: { active: true, nextRunAt: LessThan(new Date()) },
    });

    if (dueRules.length === 0) return;

    this.logger.log(`Traitement de ${dueRules.length} allowance(s) due(s)`);

    for (const rule of dueRules) {
      try {
        // Créer la Transaction ALLOWANCE (crédit vers le solde de l'enfant).
        await this.transactionsService.addTransaction({
          childId: rule.childId,
          amount: rule.amount,
          type: TransactionType.ALLOWANCE,
          label: `Virement automatique (${rule.frequency.toLowerCase()})`,
          createdBy: CreatedBy.SYSTEM,
        });

        // Calculer le prochain nextRunAt.
        const days = rule.frequency === AllowanceFrequency.WEEKLY ? 7 : 30;
        rule.nextRunAt = new Date();
        rule.nextRunAt.setDate(rule.nextRunAt.getDate() + days);
        await this.allowanceRuleRepository.save(rule);

        this.logger.log(
          `Allowance de ${rule.amount}€ versée à l'enfant ${rule.childId}`,
        );
      } catch (error) {
        // En cas d'erreur, on ne met pas à jour nextRunAt pour réessayer au
        // prochain cycle. On log et on continue avec les autres règles.
        this.logger.error(
          `Erreur lors du traitement de l'allowance ${rule.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /*
   * updateAllowanceRule : un parent modifie une règle de virement (édition
   * partielle).
   *
   * Règles métier (décisions de design) :
   *  - amount, si fourni, doit être > 0.
   *  - frequency, si fourni, recalcule nextRunAt = maintenant + nouvelle
   *    fréquence (WEEKLY = +7 jours, MONTHLY = +30 jours). Le prochain cycle
   *    du cron reprendra à partir de cette nouvelle date.
   *  - Si seule amount ou active change, on GARDE le nextRunAt actuel (pas de
   *    reset — on ne veut pas avancer ni reculer l'échéance pour un simple
   *    changement de montant).
   *  - active, si fourni, est un boolean (suspendre / réactiver).
   *
   * @throws NotFoundException si la règle n'existe pas.
   * @throws ForbiddenException si la règle n'appartient pas à la famille.
   * @throws BadRequestException si amount <= 0.
   */
  async updateAllowanceRule(params: {
    ruleId: string;
    amount?: number;
    frequency?: AllowanceFrequency;
    active?: boolean;
    requester: JwtPayload;
  }): Promise<AllowanceRule> {
    const rule = await this.allowanceRuleRepository.findOne({
      where: { id: params.ruleId },
    });
    if (!rule) {
      throw new NotFoundException('Règle de virement non trouvée');
    }

    // Vérifier l'appartenance famille via l'enfant bénéficiaire.
    const child = await this.usersService.findById(rule.childId);
    if (!child || child.familyId !== params.requester.familyId) {
      throw new ForbiddenException(
        "Vous n'avez pas le droit de modifier ce virement",
      );
    }

    if (params.amount !== undefined && params.amount <= 0) {
      throw new BadRequestException('Le montant doit être positif');
    }

    // Appliquer les champs d'édition partielle.
    if (params.amount !== undefined) rule.amount = params.amount;
    if (params.active !== undefined) rule.active = params.active;

    // Si la fréquence change, recalculer nextRunAt = maintenant + nouvelle
    // fréquence. Si seule amount/active change, on garde le nextRunAt actuel.
    if (params.frequency !== undefined) {
      rule.frequency = params.frequency;
      const days = params.frequency === AllowanceFrequency.WEEKLY ? 7 : 30;
      const nextRunAt = new Date();
      nextRunAt.setDate(nextRunAt.getDate() + days);
      rule.nextRunAt = nextRunAt;
    }

    return this.allowanceRuleRepository.save(rule);
  }

  /*
   * deleteAllowanceRule : un parent supprime une règle de virement.
   *
   * Aucune restriction : la règle est supprimée quel que soit son état (active
   * ou non). Les Transactions ALLOWANCE déjà créées par le cron restent (ce
   * sont des transactions sur le compte de l'enfant, indépendantes de la règle).
   *
   * @throws NotFoundException si la règle n'existe pas.
   * @throws ForbiddenException si la règle n'appartient pas à la famille.
   */
  async deleteAllowanceRule(params: {
    ruleId: string;
    requester: JwtPayload;
  }): Promise<boolean> {
    const rule = await this.allowanceRuleRepository.findOne({
      where: { id: params.ruleId },
    });
    if (!rule) {
      throw new NotFoundException('Règle de virement non trouvée');
    }

    const child = await this.usersService.findById(rule.childId);
    if (!child || child.familyId !== params.requester.familyId) {
      throw new ForbiddenException(
        "Vous n'avez pas le droit de supprimer ce virement",
      );
    }

    await this.allowanceRuleRepository.delete({ id: params.ruleId });
    return true;
  }
}
