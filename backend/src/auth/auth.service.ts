import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service.js';
import type { JwtPayload } from '../common/types.js';

/*
 * AuthService : logique d'authentification (login, signup avec signature JWT).
 *
 * @Injectable() : injectable par NestJS. Dependances :
 * - usersService : pour verifier les credentials et creer les comptes.
 * - jwtService : pour signer et verifier les JWT (fourni par JwtModule).
 *
 * Separation des responsabilites :
 * - UsersService gere la DB (CRUD, hash bcrypt).
 * - AuthService gere l'auth (verification mot de passe, signature JWT).
 */
@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  /*
   * login : verifie les credentials et signe un JWT.
   *
   * Etapes :
   *  1. Trouver l'utilisateur par email.
   *  2. Comparer le mot de passe avec le hash bcrypt (validatePassword).
   *  3. Si OK, signer le JWT avec le payload { sub, email, role, familyId, firstName, lastName }.
   *  4. Retourner { token, user }.
   *
   * UnauthorizedException si l'email n'existe pas ou le mot de passe est faux.
   * On renvoie le meme message pour les deux cas (ne pas divulguer si l'email
   * existe - bonne pratique de securite).
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
      firstName: user.firstName,
      lastName: user.lastName,
    };

    // jwtService.sign(payload) : signe le payload avec le secret JWT_SECRET
    // et l'expiration configuree (7d, voir AuthModule).
    const token = this.jwtService.sign(payload);

    return { token, user };
  }

  /*
   * signup : cree la Family + le premier parent, puis signe le JWT.
   *
   * Delegue la creation a UsersService.signup (qui retourne le User), puis
   * signe le JWT comme login. La difference avec login : signup cree le
   * compte avant de signer. La signature du JWT reste la responsabilité
   * d'AuthService (UsersService ne manipule jamais le JWT).
   */
  async signup(params: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    familyName: string;
  }) {
    const user = await this.usersService.signup(params);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      familyId: user.familyId,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    const token = this.jwtService.sign(payload);

    return { token, user };
  }
}
