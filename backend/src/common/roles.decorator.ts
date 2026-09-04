import { SetMetadata } from '@nestjs/common';
import { Role } from '../users/entities/user.entity.js';

/*
 * ROLES_KEY : clé sous laquelle on stocke la liste des rôles autorisés
 * dans les métadonnées du resolver. Le RolesGuard la lit pour vérifier.
 */
export const ROLES_KEY = 'roles';

/*
 * @Roles(...roles) : décorateur de méthode qui déclare les rôles autorisés
 * à appeler le resolver décoré.
 *
 * Usage :
 *   @Mutation(() => User)
 *   @UseGuards(GqlAuthGuard, RolesGuard)
 *   @Roles(Role.PARENT)
 *   createChildAccount(...) { ... }
 *
 * SetMetadata(ROLES_KEY, roles) : NestJS attache les rôles aux métadonnées
 * de la méthode. Le RolesGuard les récupère via Reflector (voir roles.guard.ts).
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
