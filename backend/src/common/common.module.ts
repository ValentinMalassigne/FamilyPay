import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GqlAuthGuard } from './auth.guard.js';
import { RolesGuard } from './roles.guard.js';

/*
 * CommonModule : module transverse fournissant les guards d'authentification
 * et le JwtModule à tous les autres modules qui en ont besoin.
 *
 * Pourquoi ce module existe :
 * GqlAuthGuard dépend de JwtService (pour vérifier les tokens). JwtService est
 * fourni par JwtModule. Si un resolver dans UsersModule utilise @UseGuards
 * (GqlAuthGuard), NestJS instancie GqlAuthGuard dans le contexte de UsersModule
 * — il faut donc que JwtService y soit disponible. Plutôt que d'importer
 * AuthModule dans UsersModule (ce qui créerait une dépendance circulaire car
 * AuthModule importe déjà UsersModule), on regroupe JwtModule + les guards
 * dans CommonModule, importé par les deux.
 *
 * JwtModule.registerAsync : configuration asynchrone via ConfigService.
 * Le secret vient de JWT_SECRET, expiration 7 jours.
 *
 * exports: [JwtModule, GqlAuthGuard, RolesGuard]
 *   JwtModule est exporté pour que AuthService (dans AuthModule) puisse
 *   injecter JwtService sans re-configurer JwtModule. Les guards sont exportés
 *   pour être utilisables via @UseGuards() dans tous les modules importateurs.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  providers: [GqlAuthGuard, RolesGuard],
  exports: [JwtModule, GqlAuthGuard, RolesGuard],
})
export class CommonModule {}
