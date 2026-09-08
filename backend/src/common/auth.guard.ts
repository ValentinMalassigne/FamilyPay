import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import type { JwtPayload } from './types.js';

/*
 * GqlAuthGuard : guard d'authentification pour les resolvers GraphQL.
 *
 * @Injectable() : NestJS peut injecter ce guard et ses dépendances (JwtService,
 * Reflector). Un guard est une classe qui implémente CanActivate.
 *
 * CanActivate : interface avec une méthode canActivate() qui retourne true
 * (autorise) ou false/throw (interdit). NestJS appelle ce guard avant
 * d'exécuter le resolver.
 *
 * Logique :
 *  1. Vérifier si la route est marquée @Public() → si oui, laisser passer.
 *  2. Extraire le token JWT du header Authorization: Bearer <token>.
 *  3. Vérifier le token avec JwtService.verifyAsync.
 *  4. Si valide : attacher le payload à req.user (utilisé par @CurrentUser()
 *     et RolesGuard). Si invalide : throw UnauthorizedException.
 *
 * Pourquoi pas PassportJS : un guard custom est plus léger, moins de
 * boilerplate, et suffit pour un projet de démo (voir plan d'implémentation).
 */
@Injectable()
export class GqlAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    /*
     * IS_PUBLIC_KEY : si le resolver est décoré @Public(), on passe sans
     * vérifier le JWT. Permet d'isoler les routes publiques (signup, login,
     * et plus tard contributeToPotPublic) du guard global.
     */
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    /*
     * GqlExecutionContext.create(context) : adapte le ExecutionContext NestJS
     * au contexte GraphQL. getContext() récupère l'objet contextuel d'Apollo.
     *
     * Deux cas selon le transport :
     *
     * 1. HTTP (queries/mutations) :
     *    ctx.req = requête Express → ctx.req.headers.authorization contient
     *    "Bearer <jwt>".
     *
     * 2. WebSocket (subscriptions) :
     *    Le driver Apollo (@nestjs/apollo) met ctx.req = l'objet contexte
     *    graphql-ws ({ connectionParams, extra, socket }) car il n'y a pas
     *    de requête Express. Le JWT est passé par le client via
     *    connectionParams (payload du message connection_init du protocole
     *    graphql-transport-ws). On lit ctx.req.connectionParams.authorization.
     */
    const gqlContext = GqlExecutionContext.create(context);
    const ctx = gqlContext.getContext();
    const req = ctx.req;

    if (!req) {
      throw new UnauthorizedException('Contexte non disponible');
    }

    // Extraction du JWT : header HTTP ou connectionParams WebSocket.
    let token: string | undefined;

    // Cas 1 — HTTP : header Authorization: Bearer <token>
    const authHeader = req.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // Cas 2 — WebSocket : connectionParams.authorization (envoyé par le
    // client dans le message connection_init du protocole graphql-transport-ws).
    if (!token && req.connectionParams) {
      const wsAuth = req.connectionParams.authorization as string | undefined;
      if (wsAuth?.startsWith('Bearer ')) {
        token = wsAuth.split(' ')[1];
      }
    }

    if (!token) {
      throw new UnauthorizedException('Token JWT manquant');
    }

    try {
      // verifyAsync : décode et vérifie la signature + l'expiration du JWT.
      // Lance une exception si le token est invalide/expiré.
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      // On attache le payload à req.user pour @CurrentUser() et RolesGuard.
      // Pour les WS, req est l'objet contexte graphql-ws — on y pose .user
      // de la même façon, les décorateurs lisent ctx.req?.user.
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token JWT invalide ou expiré');
    }
  }
}
