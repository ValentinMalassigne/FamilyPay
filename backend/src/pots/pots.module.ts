import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pot } from './entities/pot.entity.js';
import { PotContribution } from './entities/pot-contribution.entity.js';
import { PotsService } from './pots.service.js';
import { PotsResolver } from './pots.resolver.js';
import { TransactionsModule } from '../transactions/transactions.module.js';
import { UsersModule } from '../users/users.module.js';
import { CommonModule } from '../common/common.module.js';

/*
 * PotsModule : module regroupant les entités Pot / PotContribution et leurs
 * resolvers/services.
 *
 * imports:
 * - TypeOrmModule.forFeature([Pot, PotContribution]) : enregistre les
 *   repositories pour Pot et PotContribution dans le scope de ce module.
 *   Repository<Pot> et Repository<PotContribution> deviennent injectables
 *   dans PotsService via @InjectRepository().
 * - TransactionsModule : fournit TransactionsService (pour créer les
 *   transactions POT_CONTRIBUTION et POT_WITHDRAWAL via addTransaction).
 *   TransactionsModule exporte TransactionsService (voir transactions.module.ts).
 * - UsersModule : fournit UsersService (pour vérifier l'appartenance famille
 *   d'un enfant lors de createPot / withdrawFromPot).
 * - CommonModule : fournit RolesGuard (pour @UseGuards(RolesGuard) sur
 *   createPot) et le décorateur @Public() (pour contributeToPotPublic).
 *
 * providers: [PotsService, PotsResolver]
 *   PotsService : logique métier (création, contribution, retrait, filtrage).
 *   PotsResolver : resolvers GraphQL (query pots, mutations createPot,
 *   contributeToPotPublic, withdrawFromPot).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Pot, PotContribution]),
    TransactionsModule,
    UsersModule,
    CommonModule,
  ],
  providers: [PotsService, PotsResolver],
})
export class PotsModule {}
