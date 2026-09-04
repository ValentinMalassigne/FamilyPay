import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { User } from './user.entity.js';

/*
 * BlockActor : enum représentant qui a bloqué la carte de l'enfant.
 * PARENT : le parent a bloqué → seul un parent peut débloquer.
 * CHILD  : l'enfant s'est bloqué lui-même → il peut se débloquer seul.
 * null   : carte non bloquée (ou l'enfant peut bloquer/débloquer librement).
 *
 * Règle métier (PROJECT_CONTEXT.md §4) : un parent peut TOUJOURS bloquer/débloquer,
 * quel que soit l'état actuel. Le guard sur la mutation de blocage doit donc
 * distinguer l'appelant (parent → toujours OK ; enfant → vérifier blockedBy).
 */
export enum BlockActor {
  PARENT = 'PARENT',
  CHILD = 'CHILD',
}

registerEnumType(BlockActor, { name: 'BlockActor' });

/*
 * ChildAccount : compte de l'enfant (solde, état de blocage).
 *
 * @Entity() + @ObjectType() : table PostgreSQL "child_account" + type GraphQL.
 *
 * Le solde (balance) est STOCKÉ et mis à jour à chaque transaction, jamais
 * recalculé à la volée (PROJECT_CONTEXT.md §4). C'est plus rapide en lecture
 * et évite des agrégations à chaque requête.
 *
 * Relations GraphQL (schéma §6) : transactions, pots, missions sont listés
 * dans le type ChildAccount mais pas encore implémentés (leurs entités n'existent
 * pas). On les exposera plus tard via des field resolvers dans leurs modules
 * respectifs. Pour l'instant on expose id, user, balance, blocked, blockedBy.
 */
@ObjectType()
@Entity()
export class ChildAccount {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /*
   * Relation OneToOne vers User (role=CHILD).
   * Un ChildAccount correspond à un et un seul User de rôle CHILD.
   * @JoinColumn({ name: 'userId' }) : crée la colonne "userId" en base,
   * clé étrangère vers user.id.
   *
   * @Field(() => User) : expose le user dans le schéma GraphQL. NestJS résout
   * automatiquement ce champ grâce à la relation TypeORM lazy — si le client
   * GraphQL demande `user { firstName }`, NestJS charge la relation à la volée.
   */
  @Column({ type: 'uuid', unique: true })
  userId: string;

  @OneToOne(() => User, { lazy: true, eager: false })
  @JoinColumn({ name: 'userId' })
  @Field(() => User)
  user: Promise<User>;

  /*
   * balance : solde courant en euros. Stocké (pas recalculé).
   * @Column({ type: 'float', default: 0 }) : nombre à virgule, valeur initiale 0.
   * @Field() : exposé en GraphQL (type Float non-null, schéma §6).
   */
  @Field()
  @Column({ type: 'float', default: 0 })
  balance: number;

  /*
   * blocked : carte bloquée ou non. @Column({ default: false }) → false à la création.
   * @Field() → Boolean non-null en GraphQL.
   */
  @Field()
  @Column({ default: false })
  blocked: boolean;

  /*
   * blockedBy : qui a bloqué la carte (PARENT ou CHILD), ou null si non bloqué.
   * @Column({ type: 'enum', enum: BlockActor, nullable: true }) : enum PG nullable.
   * @Field(() => BlockActor, { nullable: true }) : exposé en GraphQL, nullable
   * car la carte peut être non bloquée.
   */
  @Field(() => BlockActor, { nullable: true })
  @Column({ type: 'enum', enum: BlockActor, nullable: true })
  blockedBy: BlockActor | null;
}
