import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthResolver } from './auth.resolver.js';
import { UsersModule } from '../users/users.module.js';
import { CommonModule } from '../common/common.module.js';

/*
 * AuthModule : module d'authentification.
 *
 * imports:
 * - UsersModule : fournit UsersService (exporté par UsersModule) pour que
 *   AuthService puisse l'injecter (vérification credentials, création comptes).
 * - CommonModule : fournit JwtModule (et donc JwtService injectable dans
 *   AuthService pour signer les tokens) + les guards transverses.
 *
 * providers:
 * - AuthService : logique d'auth (login, signup, signature JWT).
 * - AuthResolver : resolvers GraphQL (login, signup).
 *
 * La config JwtModule (secret, expiration) est centralisée dans CommonModule
 * pour éviter la duplication et résoudre le problème de disponibilité de
 * JwtService dans les modules qui utilisent les guards.
 */
@Module({
  imports: [UsersModule, CommonModule],
  providers: [AuthService, AuthResolver],
})
export class AuthModule {}
