import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { AuthService } from './auth.service.js';
import { AuthPayload } from './dto/auth-payload.dto.js';
import { Public } from '../common/public.decorator.js';

/*
 * AuthResolver : resolvers GraphQL d'authentification (login, signup).
 *
 * @Resolver() : déclare cette classe comme un resolver GraphQL. Sans argument
 * (pas de type objet cible), car login/signup retournent AuthPayload, pas un
 * type objet existant avec des field resolvers.
 *
 * Ces deux mutations sont publiques (pas de @UseGuards(GqlAuthGuard)) :
 * - signup : crée le compte, pas besoin d'être authentifié.
 * - login : vérifie les credentials, c'est l'authentification elle-même.
 *
 * @Public() : marque ces routes comme publiques pour le guard global (si activé).
 * Même sans guard global, c'est explicite et documente l'intention.
 */
@Resolver()
export class AuthResolver {
  constructor(private authService: AuthService) {}

  /*
   * Mutation login : authentifie un utilisateur.
   *
   * @Mutation(() => AuthPayload) : déclare une mutation GraphQL qui retourne
   * un AuthPayload. Le schéma généré contiendra :
   *   login(email: String!, password: String!): AuthPayload!
   *
   * @Args('email') / @Args('password') : extraient les arguments de la mutation
   * GraphQL. NestJS les valide contre le type déclaré (String non-null).
   */
  @Public()
  @Mutation(() => AuthPayload)
  async login(
    @Args('email') email: string,
    @Args('password') password: string,
  ): Promise<AuthPayload> {
    return this.authService.login(email, password);
  }

  /*
   * Mutation signup : crée la première Family + le premier parent.
   *
   * Non listée dans le schéma §6 mais nécessaire pour démarrer le flux
   * (PROJECT_CONTEXT.md §4 : "Le premier parent s'inscrit (crée sa Family)").
   *
   * Schéma généré :
   *   signup(firstName: String!, lastName: String!, email: String!,
   *          password: String!, familyName: String!): AuthPayload!
   */
  @Public()
  @Mutation(() => AuthPayload)
  async signup(
    @Args('firstName') firstName: string,
    @Args('lastName') lastName: string,
    @Args('email') email: string,
    @Args('password') password: string,
    @Args('familyName') familyName: string,
  ): Promise<AuthPayload> {
    return this.authService.signup({
      firstName,
      lastName,
      email,
      password,
      familyName,
    });
  }
}
