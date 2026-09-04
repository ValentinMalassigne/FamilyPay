import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service.js';
import type { JwtPayload } from '../common/types.js';

/*
 * AuthService : logique d'authentification (login, signup avec signature JWT).
 *
 * @Injectable() : injectable par NestJS. Dépendances :
 * - usersService : pour vérifier les credentials et créer les comptes.
 * - jwtService : pour signer et vérifier les JWT (fourni par JwtModule).
 *
 * Séparation des responsabilités :
 * - UsersService gère la DB (CRUD, hash bcrypt).
 * - AuthService gère l'auth (vérification mot de passe, signature JWT).
 */
@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  /*
   * login : vérifie les credentials et signe un JWT.
   *
   * Étapes :
   *  1. Trouver l'utilisateur par email.
   *  2. Comparer le mot de passe avec le hash bcrypt (validatePassword).
   *  3. Si OK, signer le JWT avec le payload { sub, email, role, familyId }.
   *  4. Retourner { token, user }.
   *
   * UnauthorizedException si l'email n'existe pas ou le mot de passe est faux.
   * On renvoie le même message pour les deux cas (ne pas divulguer si l'email
   * existe — bonne pratique de sécurité).
   */
  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const valid = await this.usersService.validatePassword(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      familyId: user.familyId,
    };

    // jwtService.sign(payload) : signe le payload avec le secret JWT_SECRET
    // et l'expiration configurée (7d, voir AuthModule).
    const token = this.jwtService.sign(payload);

    return { token, user };
  }

  /*
   * signup : crée la Family + le premier parent, puis signe le JWT.
   *
   * Délègue la création à UsersService.signup, puis signe le JWT comme login.
   * La différence avec login : signup crée le compte avant de signer.
   */
  async signup(params: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    familyName: string;
  }) {
    const { user } = await this.usersService.signup(params);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      familyId: user.familyId,
    };

    const token = this.jwtService.sign(payload);

    return { token, user };
  }
}
