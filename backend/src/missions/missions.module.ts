import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mission } from './entities/mission.entity.js';
import { MissionsService } from './missions.service.js';
import { MissionsResolver } from './missions.resolver.js';
import { TransactionsModule } from '../transactions/transactions.module.js';
import { UsersModule } from '../users/users.module.js';
import { CommonModule } from '../common/common.module.js';

/*
 * MissionsModule : module regroupant l'entité Mission et ses resolvers/services.
 *
 * imports:
 * - TypeOrmModule.forFeature([Mission]) : enregistre Repository<Mission> dans
 *   le scope de ce module. Injectable via @InjectRepository() dans MissionsService.
 * - TransactionsModule : fournit TransactionsService (pour créer la Transaction
 *   MISSION_REWARD quand une mission est validée).
 * - UsersModule : fournit UsersService (vérifier l'appartenance famille).
 * - CommonModule : fournit RolesGuard (pour @UseGuards(RolesGuard) sur
 *   createMission et validateMission).
 *
 * providers: [MissionsService, MissionsResolver]
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Mission]),
    TransactionsModule,
    UsersModule,
    CommonModule,
  ],
  providers: [MissionsService, MissionsResolver],
})
export class MissionsModule {}
