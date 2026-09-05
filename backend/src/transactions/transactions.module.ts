import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity.js';
import { ChildAccount } from '../users/entities/child-account.entity.js';
import { TransactionsService } from './transactions.service.js';
import { TransactionsResolver } from './transactions.resolver.js';
import { UsersModule } from '../users/users.module.js';
import { CommonModule } from '../common/common.module.js';

/*
 * TransactionsModule : module regroupant l'entité Transaction et ses
 * resolvers/services.
 *
 * imports:
 * - TypeOrmModule.forFeature([Transaction, ChildAccount]) : enregistre les
 *   repositories pour les entités Transaction et ChildAccount dans le scope de
 *   ce module. Repository<Transaction> et Repository<ChildAccount> deviennent
 *   injectables dans TransactionsService via @InjectRepository().
 *   ChildAccount est nécessaire car TransactionsService met à jour le solde
 *   (balance) du ChildAccount à chaque transaction. On l'enregistre ici en
 *   plus de UsersModule : un repository TypeORM doit être déclaré dans chaque
 *   module qui l'injecte (UsersModule n'exporte que UsersService, pas le
 *   repository).
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
    TypeOrmModule.forFeature([Transaction, ChildAccount]),
    UsersModule,
    CommonModule,
  ],
  providers: [TransactionsService, TransactionsResolver],
  exports: [TransactionsService],
})
export class TransactionsModule {}
