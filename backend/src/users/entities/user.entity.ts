import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Family } from './family.entity.js';

/*
 * Role : enum représentant le rôle d'un utilisateur dans sa famille.
 * PARENT : peut créer des comptes enfants, valider des missions, bloquer des cartes...
 * CHILD : a son propre compte, son solde, ses transactions (PROJECT_CONTEXT.md §4).
 */
export enum Role {
  PARENT = 'PARENT',
  CHILD = 'CHILD',
}

/*
 * registerEnumType : enregistre l'enum TypeScript comme type enum GraphQL.
 * Sans ça, NestJS ne sait pas mapper l'enum vers le schéma GraphQL.
 * Le nom 'Role' est le nom du type dans le schéma généré :
 *   enum Role { PARENT, CHILD }
 */
registerEnumType(Role, { name: 'Role' });

/*
 * User : entité représentant un utilisateur (parent ou enfant).
 *
 * @Entity() + @ObjectType() : mappe sur la table PostgreSQL "user" ET expose
 * le type GraphQL "User" dans le schéma (approche code-first, voir §3).
 *
 * Champs DB (PROJECT_CONTEXT.md §4) :
 *   id, email, passwordHash, role, firstName, lastName, familyId, createdByUserId, createdAt
 *
 * Champs exposés en GraphQL (schéma §6) : id, email, role, firstName, lastName.
 * passwordHash n'est JAMAIS exposé en GraphQL (sécurité).
 * familyId, createdByUserId, createdAt sont en DB mais pas dans le type GraphQL
 * User du §6 — on suit le schéma §6 comme contrat.
 */
@ObjectType()
@Entity()
export class User {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ unique: true })
  email: string;

  /*
   * passwordHash : hash bcrypt du mot de passe (PROJECT_CONTEXT.md §8).
   * Pas de @Field → non exposé en GraphQL. La colonne est nullable le temps
   * de créer le hash, mais en pratique toujours renseigné.
   */
  @Column()
  passwordHash: string;

  /*
   * @Column({ type: 'enum', enum: Role }) : stocke l'enum en PostgreSQL via
   * un type natif enum. La valeur sera 'PARENT' ou 'CHILD'.
   * @Field(() => Role) : expose le champ en GraphQL avec le type enum Role.
   */
  @Field(() => Role)
  @Column({ type: 'enum', enum: Role })
  role: Role;

  @Field()
  @Column()
  firstName: string;

  @Field()
  @Column()
  lastName: string;

  /*
   * Relation N-1 vers Family : un User appartient à une Family.
   * @ManyToOne + @JoinColumn({ name: 'familyId' }) : crée une colonne
   * "familyId" en base qui référence family.id (clé étrangère).
   * lazy: true → chargement paresseux de la relation.
   * Non exposé en GraphQL (pas dans le type User du §6).
   */
  @Column({ type: 'uuid' })
  familyId: string;

  @ManyToOne(() => Family, (family) => family.users, { lazy: true })
  @JoinColumn({ name: 'familyId' })
  family: Promise<Family>;

  /*
   * createdByUserId : ID de l'utilisateur qui a créé ce compte (un parent).
   * Nullable car le premier parent (créé via signup) n'a pas de créateur.
   * Stocké en colonne simple (pas de relation FK car on veut juste tracer l'auteur).
   * Non exposé en GraphQL.
   */
  @Column({ nullable: true, type: 'uuid' })
  createdByUserId: string | null;

  /*
   * @CreateDateColumn() : TypeORM remplit automatiquement ce champ à l'insertion
   * avec la date/heure courante. Non exposé en GraphQL (pas dans le type User §6).
   */
  @CreateDateColumn()
  createdAt: Date;
}
