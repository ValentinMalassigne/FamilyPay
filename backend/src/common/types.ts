import { Role } from '../users/entities/user.entity.js';

/*
 * JwtPayload : structure du payload encodé dans le JWT.
 * Ce n'est pas une entité DB ni un type GraphQL — c'est juste l'objet signé
 * côté backend puis vérifié à chaque requête authentifiée.
 *
 * - sub : subject = l'ID de l'utilisateur (convention JWT standard).
 * - email : l'email, utile pour logger/identifier sans recharger l'user.
 * - role : PARENT ou CHILD, vérifié par le RolesGuard.
 * - familyId : l'ID de la famille, pour vérifier qu'un parent n'accède
 *   qu'aux ressources de sa propre famille.
 */
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  familyId: string;
  firstName: string;
  lastName: string;
}
