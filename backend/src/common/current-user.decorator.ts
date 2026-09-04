import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { JwtPayload } from './types.js';

/*
 * @CurrentUser() : param decorator qui extrait le payload JWT de la requête.
 *
 * Usage dans un resolver :
 *   @Query(() => User)
 *   @UseGuards(GqlAuthGuard)
 *   me(@CurrentUser() user: JwtPayload) { ... }
 *
 * createParamDecorator : NestJS crée un décorateur de paramètre. La fonction
 * reçoit le contexte d'exécution et retourne la valeur à injecter.
 *
 * GqlExecutionContext.create(context) : adapte le ExecutionContext NestJS
 * au contexte GraphQL. getContext() récupère l'objet contextuel d'Apollo,
 * dans lequel on a stocké req.user (posé par GqlAuthGuard après vérification
 * du JWT).
 *
 * Si req.user est absent (route non authentifiée), retourne undefined.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const gqlContext = GqlExecutionContext.create(context);
    const ctx = gqlContext.getContext();
    return ctx.req?.user as JwtPayload | undefined;
  },
);
