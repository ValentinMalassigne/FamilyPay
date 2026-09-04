import { Field, ObjectType } from '@nestjs/graphql';
import { User } from '../../users/entities/user.entity.js';

/*
 * AuthPayload : type de retour de la mutation login (et signup).
 * Non listé comme entité car ce n'est pas une table — c'est juste un DTO
 * GraphQL de retour. Le schéma §6 le définit implicitement :
 *   type AuthPayload { token: String!, user: User! }
 *
 * @ObjectType() : expose ce type dans le schéma GraphQL généré.
 * Pas de @Entity() : pas de table DB.
 */
@ObjectType()
export class AuthPayload {
  /*
   * token : le JWT signé que le client stocke et renvoie dans le header
   * Authorization: Bearer <token> à chaque requête authentifiée.
   */
  @Field()
  token: string;

  /*
   * user : l'utilisateur authentifié. @Field(() => User) expose l'objet User
   * complet dans le schéma — le client peut demander les champs qu'il veut
   * (id, email, role, firstName, lastName).
   */
  @Field(() => User)
  user: User;
}
