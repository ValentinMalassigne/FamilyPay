import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AllowanceRule } from './entities/allowance-rule.entity.js';
import { AllowancesService } from './allowances.service.js';
import { AllowancesResolver } from './allowances.resolver.js';
import { TransactionsModule } from '../transactions/transactions.module.js';
import { UsersModule } from '../users/users.module.js';
import { CommonModule } from '../common/common.module.js';

/*
 * AllowancesModule : module regroupant l'entité AllowanceRule et son
 * resolver/service, y compris le cron @Cron qui traite les virements dus.
 *
 * imports:
 * - TypeOrmModule.forFeature([AllowanceRule]) : enregistre
 *   Repository<AllowanceRule> dans le scope de ce module.
 * - TransactionsModule : fournit TransactionsService (pour créer la
 *   Transaction ALLOWANCE lors de l'exécution du cron).
 * - UsersModule : fournit UsersService (vérifier l'appartenance famille).
 * - CommonModule : fournit RolesGuard (pour createAllowanceRule).
 *
 * providers: [AllowancesService, AllowancesResolver]
 *   AllowancesService contient le @Cron processDueAllowances — NestJS
 *   l'enregistre automatiquement comme provider, et @nestjs/schedule
 *   détecte le décorateur @Cron au démarrage (nécessite ScheduleModule
 *   .forRoot() dans AppModule).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([AllowanceRule]),
    TransactionsModule,
    UsersModule,
    CommonModule,
  ],
  providers: [AllowancesService, AllowancesResolver],
})
export class AllowancesModule {}
