import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity.js';
import { TransactionsService } from './transactions.service.js';
import { TransactionsResolver } from './transactions.resolver.js';
import { UsersModule } from '../users/users.module.js';
import { CommonModule } from '../common/common.module.js';

/*
 * TransactionsModule : module regroupant l'entité Transaction et ses
 * resolvers/services.
 *
 * imports:
 * - TypeOrmModule.forFeature([Transaction]) : enregistre le repository pour
 *   l'entité Transaction dans le scope de ce module. Repository<Transaction>
 *   devient injectable dans TransactionsService via @InjectRepository().
 * - UsersModule : fournit UsersService (pour vérifier l'appartenance famille
 *   et charger les utilisateurs).
 * - CommonModule : fournit GqlAuthGuard et RolesGuard (pour les mutations
 *   authentifiées et restreintes par rôle).
 *
 * providers:
 * - TransactionsService : logique métier (CRUD, mise à jour du solde).
 * - TransactionsResolver : resolvers GraphQL (queries, mutations, subscriptions).
 *
 * exports: [TransactionsService]
 *   TransactionsService est exporté au cas où d'autres modules (ex: AllowanceModule
 *   pour les virements automatiques) auraient besoin de créer des transactions.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    UsersModule,
    CommonModule,
  ],
  providers: [TransactionsService, TransactionsResolver],
  exports: [TransactionsService],
})
export class TransactionsModule {}
