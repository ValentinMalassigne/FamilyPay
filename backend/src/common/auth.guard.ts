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
     * au contexte GraphQL. getContext() récupère l'objet contextuel d'Apollo,
     * qui contient la requête Express (req) — avec les headers HTTP.
     */
    const gqlContext = GqlExecutionContext.create(context);
    const ctx = gqlContext.getContext();

    // La requête HTTP est posée par Apollo dans le contexte GraphQL.
    const req = ctx.req;
    if (!req) {
      throw new UnauthorizedException('Requête HTTP non disponible');
    }

    // Extraction du header Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token JWT manquant');
    }

    const token = authHeader.split(' ')[1];

    try {
      // verifyAsync : décode et vérifie la signature + l'expiration du JWT.
      // Lance une exception si le token est invalide/expiré.
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      // On attache le payload à req.user pour @CurrentUser() et RolesGuard.
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token JWT invalide ou expiré');
    }
  }
}
