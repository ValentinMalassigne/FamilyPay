import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ROLES_KEY } from './roles.decorator.js';
import type { JwtPayload } from './types.js';
import type { Role } from '../users/entities/user.entity.js';

/*
 * RolesGuard : guard de contrôle d'accès basé sur le rôle (PARENT | CHILD).
 *
 * @Injectable() : injectable par NestJS, avec Reflector pour lire les
 * métadonnées posées par @Roles(...).
 *
 * Ce guard s'utilise APRÈS GqlAuthGuard dans la chaîne de guards :
 *   @UseGuards(GqlAuthGuard, RolesGuard)
 *   @Roles(Role.PARENT)
 * GqlAuthGuard a déjà vérifié le JWT et posé req.user (le payload JwtPayload,
 * qui contient role). RolesGuard lit req.user.role et le compare avec les
 * rôles autorisés.
 *
 * Si req.user est absent (route non authentifiée ou @Public), on laisse passer
 * — le contrôle de rôle ne s'applique qu'aux routes authentifiées.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Lecture des rôles autorisés via les métadonnées posées par @Roles(...).
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Pas de @Roles() sur ce resolver → pas de restriction de rôle.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const gqlContext = GqlExecutionContext.create(context);
    const ctx = gqlContext.getContext();
    const user = ctx.req?.user as JwtPayload | undefined;

    // Si pas d'user (route publique), on ne bloque pas — laissone passer.
    // Le contrôle d'accès métier (qui peut créer quoi) est fait dans le service.
    if (!user) {
      return true;
    }

    // Vérifie que le rôle de l'utilisateur est dans la liste des rôles requis.
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Rôle ${user.role} non autorisé pour cette opération`,
      );
    }

    return true;
  }
}
