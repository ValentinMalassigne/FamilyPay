import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { User, Role } from './entities/user.entity.js';
import { RolesGuard } from '../common/roles.guard.js';
import { Roles } from '../common/roles.decorator.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import type { JwtPayload } from '../common/types.js';

/*
 * UsersResolver : resolvers GraphQL pour les utilisateurs.
 *
 * @Resolver(() => User) : déclare un resolver attaché au type User.
 * Le () => User indique que ce resolver gère les field resolvers du type User
 * (ici il n'y en a pas, mais c'est aussi utilisé pour les query/mutation
 * qui retournent des User).
 *
 * Authentification : GqlAuthGuard est registered globallement via APP_GUARD
 * dans AppModule → tous les resolvers exigent un JWT valide par défaut, sans
 * besoin de @UseGuards(GqlAuthGuard) sur chaque méthode. Les exceptions
 * publiques sont marquées @Public() (voir AuthResolver).
 */
@Resolver(() => User)
export class UsersResolver {
  constructor(private usersService: UsersService) {}

  /*
   * Query me : retourne l'utilisateur courant (authentifié via JWT).
   *
   * Pas de @UseGuards ici : GqlAuthGuard (global via APP_GUARD) vérifie déjà
   * le JWT et pose le payload dans req.user (accessible via @CurrentUser()).
   *
   * @CurrentUser() user : extrait le payload JWT (JwtPayload) du contexte.
   * On a l'ID (sub), on charge l'utilisateur complet depuis la DB.
   *
   * Schéma généré : me: User!
   */
  @Query(() => User)
  async me(@CurrentUser() user: JwtPayload): Promise<User> {
    const fullUser = await this.usersService.findById(user.sub);
    if (!fullUser) {
      throw new Error('Utilisateur non trouvé');
    }
    return fullUser;
  }

  /*
   * Mutation createChildAccount : un parent crée un compte enfant.
   *
   * @UseGuards(RolesGuard) : GqlAuthGuard est global (APP_GUARD), on n'a plus
   * besoin de le lister. On garde RolesGuard pour vérifier @Roles(Role.PARENT).
   * NestJS exécute d'abord le guard global (GqlAuthGuard), puis RolesGuard.
   *
   * @Roles(Role.PARENT) : seul un parent peut créer un compte enfant.
   *
   * Le familyId de l'enfant hérite de celui du parent créateur (PROJECT_CONTEXT.md §4).
   * createdByUserId = l'ID du parent créateur (user.sub).
   */
  @Mutation(() => User)
  @UseGuards(RolesGuard)
  @Roles(Role.PARENT)
  async createChildAccount(
    @CurrentUser() creator: JwtPayload,
    @Args('email') email: string,
    @Args('password') password: string,
    @Args('firstName') firstName: string,
    @Args('lastName') lastName: string,
  ): Promise<User> {
    return this.usersService.createChildAccount({
      email,
      password,
      firstName,
      lastName,
      creatorId: creator.sub,
      creatorFamilyId: creator.familyId,
    });
  }

  /*
   * Mutation createParentAccount : un parent crée un second parent.
   *
   * Mêmes guards que createChildAccount (PARENT uniquement).
   * Pas de ChildAccount créé (seuls les enfants ont un solde).
   */
  @Mutation(() => User)
  @UseGuards(RolesGuard)
  @Roles(Role.PARENT)
  async createParentAccount(
    @CurrentUser() creator: JwtPayload,
    @Args('email') email: string,
    @Args('password') password: string,
    @Args('firstName') firstName: string,
    @Args('lastName') lastName: string,
  ): Promise<User> {
    return this.usersService.createParentAccount({
      email,
      password,
      firstName,
      lastName,
      creatorId: creator.sub,
      creatorFamilyId: creator.familyId,
    });
  }
}
