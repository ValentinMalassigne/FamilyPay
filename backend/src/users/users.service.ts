import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, Role } from './entities/user.entity.js';
import { Family } from './entities/family.entity.js';
import { ChildAccount } from './entities/child-account.entity.js';

/*
 * UsersService : service contenant la logique métier autour des utilisateurs.
 *
 * @Injectable() : NestJS peut injecter ce service dans les resolvers et autres
 * services. L'injection de dépendances est le cœur de NestJS : on ne new pas
 * les services manuellement, on les déclare dans le module et NestJS gère
 * le cycle de vie et l'injection.
 *
 * Dépendances injectées via le constructeur :
 * - userRepository : Repository<User> de TypeORM, injectée via @InjectRepository.
 *   Fournit find/findOne/save/remove etc. pour interroger la table "user".
 * - familyRepository : Repository<Family>.
 * - childAccountRepository : Repository<ChildAccount>.
 *
 * Les Repository sont disponibles car UsersModule fait TypeOrmModule.forFeature
 * ([User, Family, ChildAccount]).
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Family)
    private familyRepository: Repository<Family>,
    @InjectRepository(ChildAccount)
    private childAccountRepository: Repository<ChildAccount>,
  ) {}

  /*
   * findByEmail : recherche un utilisateur par son email.
   * Retourne null si non trouvé. Utilisé par AuthService pour le login.
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  /*
   * findById : recherche un utilisateur par son ID.
   * Utilisé par la query me (qui charge l'utilisateur complet depuis le payload JWT).
   */
  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  /*
   * findChildAccountByUserId : recherche le ChildAccount d'un enfant par son
   * userId (l'ID du User role=CHILD). Retourne null si non trouvé.
   *
   * Utilisé par la query childAccount(childId) : childId est l'ID du User enfant,
   * et ChildAccount.userId pointe vers ce User (relation OneToOne).
   */
  async findChildAccountByUserId(userId: string): Promise<ChildAccount | null> {
    return this.childAccountRepository.findOne({ where: { userId } });
  }

  /*
   * signup : crée la première Family + le premier User (role=PARENT).
   *
   * Flux (PROJECT_CONTEXT.md §4) : pas d'invitation par code. Le premier
   * parent s'inscrit et crée sa Family. Ensuite, depuis son espace, il crée
   * les comptes enfants et le second parent (voir createChildAccount /
   * createParentAccount).
   *
   * Étapes :
   *  1. Vérifier que l'email n'existe pas déjà (sinon ConflictException).
   *  2. Hasher le mot de passe avec bcrypt (PROJECT_CONTEXT.md §8).
   *  3. Créer la Family.
   *  4. Créer le User (role=PARENT, familyId=family.id, createdByUserId=null).
   *
   * Retourne le User créé (sans token). La signature du JWT est la
   * responsabilité d'AuthService, pas de UsersService (séparation des
   * responsabilités : UsersService gère la DB, AuthService gère le JWT).
   *
   * bcrypt.hash(password, 10) : 10 = nombre de rounds (cost factor). Plus c'est
   * élevé, plus c'est lent (donc résistant au brute-force) mais coûteux CPU.
   * 10 est la valeur standard.
   */
  async signup(params: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    familyName: string;
  }): Promise<User> {
    const existing = await this.findByEmail(params.email);
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet email');
    }

    const passwordHash = await bcrypt.hash(params.password, 10);

    // Création de la Family. create() instancie l'objet, save() l'insère en DB.
    const family = this.familyRepository.create({ name: params.familyName });
    const savedFamily = await this.familyRepository.save(family);

    const user = this.userRepository.create({
      email: params.email,
      passwordHash,
      role: Role.PARENT,
      firstName: params.firstName,
      lastName: params.lastName,
      familyId: savedFamily.id,
      createdByUserId: null,
    });
    return this.userRepository.save(user);
  }

  /*
   * createChildAccount : un parent crée un compte enfant dans sa propre family.
   *
   * Garde en mémoire (PROJECT_CONTEXT.md §4) :
   * - Le parent n'est pas débité : le solde de l'enfant est indépendant.
   * - L'enfant a son propre JWT, distinct de celui des parents.
   *
   * Étapes :
   *  1. Vérifier l'email unique.
   *  2. Hasher le mot de passe.
   *  3. Créer le User (role=CHILD, familyId = celui du parent créateur).
   *  4. Créer le ChildAccount (balance=0, blocked=false) lié à ce User.
   */
  async createChildAccount(params: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    creatorId: string;
    creatorFamilyId: string;
  }): Promise<User> {
    const existing = await this.findByEmail(params.email);
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet email');
    }

    const passwordHash = await bcrypt.hash(params.password, 10);

    const user = this.userRepository.create({
      email: params.email,
      passwordHash,
      role: Role.CHILD,
      firstName: params.firstName,
      lastName: params.lastName,
      familyId: params.creatorFamilyId,
      createdByUserId: params.creatorId,
    });
    const savedUser = await this.userRepository.save(user);

    // Création du ChildAccount associé (solde initial = 0).
    const childAccount = this.childAccountRepository.create({
      userId: savedUser.id,
      balance: 0,
      blocked: false,
      blockedBy: null,
    });
    await this.childAccountRepository.save(childAccount);

    return savedUser;
  }

  /*
   * createParentAccount : un parent crée un second parent dans la même family.
   *
   * Pas de ChildAccount pour un parent (seuls les enfants ont un solde).
   */
  async createParentAccount(params: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    creatorId: string;
    creatorFamilyId: string;
  }): Promise<User> {
    const existing = await this.findByEmail(params.email);
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet email');
    }

    const passwordHash = await bcrypt.hash(params.password, 10);

    const user = this.userRepository.create({
      email: params.email,
      passwordHash,
      role: Role.PARENT,
      firstName: params.firstName,
      lastName: params.lastName,
      familyId: params.creatorFamilyId,
      createdByUserId: params.creatorId,
    });
    return this.userRepository.save(user);
  }

  /*
   * validatePassword : compare un mot de passe en clair avec le hash stocké.
   * Retourne true si le mot de passe correspond au hash (bcrypt.compare).
   */
  async validatePassword(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }
}
