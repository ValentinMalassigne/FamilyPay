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
 * AllowanceFrequency : fréquence du virement automatique (PROJECT_CONTEXT.md §4).
 *
 * WEEKLY  : versement hebdomadaire (toutes les 7 jours).
 * MONTHLY : versement mensuel (tous les 30 jours).
 */
export enum AllowanceFrequency {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

/*
 * registerEnumType : enregistre l'enum TypeScript comme type enum GraphQL.
 * Le nom 'AllowanceFrequency' sera utilisé dans le schéma généré.
 */
registerEnumType(AllowanceFrequency, { name: 'AllowanceFrequency' });

/*
 * AllowanceRule : entité représentant un virement automatique récurrent
 * défini par un parent vers le compte d'un enfant.
 *
 * @Entity() + @ObjectType() : table PostgreSQL "allowance_rule" + type GraphQL.
 *
 * Champs DB (PROJECT_CONTEXT.md §4) :
 *   id, childId, amount, frequency, nextRunAt, active
 *
 * Règle métier (§4) : exécuté par un cron NestJS (@nestjs/schedule) qui lit
 * les règles actives dont nextRunAt est passé, crée une Transaction ALLOWANCE,
 * met à jour le solde et calcule le prochain nextRunAt.
 *
 * Évolution du schéma §6 (non listée dans l'esquisse) — autorisée car PR backend.
 */
@ObjectType()
@Entity()
export class AllowanceRule {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /*
   * Relation ManyToOne vers User (l'enfant bénéficiaire du virement).
   * @JoinColumn({ name: 'childId' }) : colonne childId (FK vers user.id).
   * lazy: true, non exposé en GraphQL (childId exposé ci-dessous).
   */
  @ManyToOne(() => User, { lazy: true })
  @JoinColumn({ name: 'childId' })
  child: Promise<User>;

  @Field(() => ID)
  @Column({ type: 'uuid' })
  childId: string;

  /*
   * amount : montant du virement en euros (positif, crédité au solde de
   * l'enfant à chaque exécution du cron).
   */
  @Field()
  @Column({ type: 'float' })
  amount: number;

  @Field(() => AllowanceFrequency)
  @Column({ type: 'enum', enum: AllowanceFrequency })
  frequency: AllowanceFrequency;

  /*
   * nextRunAt : date/heure de la prochaine exécution du virement.
   * Le cron compare nextRunAt <= NOW() pour déterminer quelles règles traiter.
   * Mis à jour après chaque exécution (nextRunAt += frequency).
   *
   * @Column({ type: 'timestamp' }) : stocké en timestamp PostgreSQL.
   * Non exposé en GraphQL pour l'instant (champ technique géré par le cron).
   */
  @Column({ type: 'timestamp' })
  nextRunAt: Date;

  /*
   * active : true si la règle est active (le cron la traite), false si
   * désactivée par le parent (le cron l'ignore). Permet de suspendre un
   * virement sans le supprimer.
   */
  @Field()
  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
