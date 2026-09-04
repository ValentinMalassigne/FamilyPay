import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity.js';
import { Family } from './entities/family.entity.js';
import { ChildAccount } from './entities/child-account.entity.js';
import { UsersService } from './users.service.js';
import { UsersResolver } from './users.resolver.js';
import { CommonModule } from '../common/common.module.js';

/*
 * UsersModule : module regroupant les entités User, Family, ChildAccount
 * et leurs resolvers/services.
 *
 * imports:
 * - TypeOrmModule.forFeature([User, Family, ChildAccount]) : enregistre les
 *   repositories pour ces 3 entités dans le scope de ce module. Les
 *   Repository<User>, Repository<Family> et Repository<ChildAccount> deviennent
 *   injectables dans UsersService via @InjectRepository().
 * - CommonModule : fournit GqlAuthGuard et RolesGuard (qui dépendent de
 *   JwtService) pour que UsersResolver puisse les utiliser via @UseGuards().
 *
 * providers: [UsersService, UsersResolver]
 *   UsersService : logique métier (CRUD, hash bcrypt).
 *   UsersResolver : resolvers GraphQL (me, createChildAccount, createParentAccount).
 *
 * exports: [UsersService]
 *   UsersService est exporté car AuthModule (AuthService) en a besoin pour
 *   vérifier les credentials et créer les comptes.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Family, ChildAccount]),
    CommonModule,
  ],
  providers: [UsersService, UsersResolver],
  exports: [UsersService],
})
export class UsersModule {}
