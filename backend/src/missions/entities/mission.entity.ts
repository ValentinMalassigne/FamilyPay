import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { User } from '../../users/entities/user.entity.js';

/*
 * MissionStatus : enum représentant le cycle de vie d'une mission
 * (PROJECT_CONTEXT.md §4).
 *
 * PENDING      : mission créée par un parent, en attente d'action de l'enfant.
 * DONE_BY_CHILD : l'enfant a marqué la mission comme faite, en attente de
 *                validation par le parent.
 * VALIDATED    : le parent a validé la mission → crée une Transaction
 *                MISSION_REWARD (crédit de la récompense vers le solde).
 * REJECTED     : le parent a refusé la mission (pas de récompense).
 *
 * Flux : PENDING → DONE_BY_CHILD → VALIDATED ou REJECTED.
 * Les transitions sont strictes (voir MissionsService).
 */
export enum MissionStatus {
  PENDING = 'PENDING',
  DONE_BY_CHILD = 'DONE_BY_CHILD',
  VALIDATED = 'VALIDATED',
  REJECTED = 'REJECTED',
}

/*
 * registerEnumType : enregistre l'enum TypeScript comme type enum GraphQL.
 * Le nom 'MissionStatus' sera utilisé dans le schéma généré.
 */
registerEnumType(MissionStatus, { name: 'MissionStatus' });

/*
 * Mission : entité représentant une mission rémunérée assignée à un enfant.
 *
 * @Entity() + @ObjectType() : mappe sur la table PostgreSQL "mission" ET
 * expose le type GraphQL "Mission" dans le schéma (code-first, §3).
 *
 * Champs DB (PROJECT_CONTEXT.md §4) :
 *   id, childId, createdByParentId, title, description, reward, status,
 *   createdAt, completedAt, validatedAt
 *
 * Champs exposés en GraphQL (schéma §6) :
 *   id, title, reward, status
 *   childId, createdByParentId, description, createdAt, completedAt,
 *   validatedAt sont stockés en DB mais non exposés (non listés dans le type
 *   Mission du §6). On suit le schéma §6 comme contrat partagé avec web/mobile.
 */
@ObjectType()
@Entity()
export class Mission {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /*
   * Relation ManyToOne vers User (l'enfant à qui la mission est assignée).
   * @JoinColumn({ name: 'childId' }) : crée la colonne childId (FK vers user.id).
   * lazy: true → chargement paresseux. Non exposé en GraphQL (pas dans le §6).
   */
  @ManyToOne(() => User, { lazy: true })
  @JoinColumn({ name: 'childId' })
  child: Promise<User>;

  @Column({ type: 'uuid' })
  childId: string;

  /*
   * createdByParentId : ID du parent qui a créé la mission.
   * Stocké en colonne simple (pas de relation FK car on veut juste tracer
   * l'auteur). Non exposé en GraphQL.
   */
  @Column({ type: 'uuid' })
  createdByParentId: string;

  @Field()
  @Column()
  title: string;

  /*
   * description : description détaillée de la mission (stockée en DB per §4,
   * non exposée en GraphQL car absente du type Mission du §6). Nullable car
   * la mutation createMission du §6 ne prend pas de description.
   */
  @Column({ nullable: true })
  description: string | null;

  @Field()
  @Column({ type: 'float' })
  reward: number;

  @Field(() => MissionStatus)
  @Column({ type: 'enum', enum: MissionStatus })
  status: MissionStatus;

  @CreateDateColumn()
  createdAt: Date;

  /*
   * completedAt : date à laquelle l'enfant a marqué la mission comme faite
   * (passage PENDING → DONE_BY_CHILD). Nullable tant que non complétée.
   */
  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  /*
   * validatedAt : date à laquelle le parent a validé ou refusé la mission
   * (passage DONE_BY_CHILD → VALIDATED ou REJECTED). Nullable tant que non
   * traitée par le parent.
   */
  @Column({ type: 'timestamp', nullable: true })
  validatedAt: Date | null;
}
