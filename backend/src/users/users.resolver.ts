import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { User, Role } from './entities/user.entity.js';
import { GqlAuthGuard } from '../common/auth.guard.js';
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
 */
@Resolver(() => User)
export class UsersResolver {
  constructor(private usersService: UsersService) {}

  /*
   * Query me : retourne l'utilisateur courant (authentifié via JWT).
   *
   * @UseGuards(GqlAuthGuard) : exige un JWT valide. Le guard vérifie le token
   * et pose le payload dans req.user (accessible via @CurrentUser()).
   *
   * @CurrentUser() user : extrait le payload JWT (JwtPayload) du contexte.
   * On a l'ID (sub), on charge l'utilisateur complet depuis la DB.
   *
   * Schéma généré : me: User!
   */
  @Query(() => User)
  @UseGuards(GqlAuthGuard)
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
   * @UseGuards(GqlAuthGuard, RolesGuard) :
   *   1. GqlAuthGuard vérifie le JWT et pose req.user.
   *   2. RolesGuard vérifie que req.user.role est dans @Roles(...).
   *
   * @Roles(Role.PARENT) : seul un parent peut créer un compte enfant.
   *
   * Le familyId de l'enfant hérite de celui du parent créateur (PROJECT_CONTEXT.md §4).
   * createdByUserId = l'ID du parent créateur (user.sub).
   */
  @Mutation(() => User)
  @UseGuards(GqlAuthGuard, RolesGuard)
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
  @UseGuards(GqlAuthGuard, RolesGuard)
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
