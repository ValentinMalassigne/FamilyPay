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
 * TransactionType : enum représentant le type de transaction (PROJECT_CONTEXT.md §4).
 * RECHARGE : recharge manuelle ponctuelle par un parent (paiement CB simulé).
 * ALLOWANCE : versement automatique récurrent généré par le cron.
 * EXPENSE : dépense simulée ajoutée manuellement par l'enfant ou un parent.
 * MISSION_REWARD : récompense pour une mission validée.
 * QUIZ_REWARD : récompense pour un quiz réussi.
 * POT_CONTRIBUTION : contribution à une cagnotte.
 * POT_WITHDRAWAL : retrait d'une cagnotte.
 */
export enum TransactionType {
  RECHARGE = 'RECHARGE',
  ALLOWANCE = 'ALLOWANCE',
  EXPENSE = 'EXPENSE',
  MISSION_REWARD = 'MISSION_REWARD',
  QUIZ_REWARD = 'QUIZ_REWARD',
  POT_CONTRIBUTION = 'POT_CONTRIBUTION',
  POT_WITHDRAWAL = 'POT_WITHDRAWAL',
}

/*
 * registerEnumType : enregistre l'enum TypeScript comme type enum GraphQL.
 * Sans ça, NestJS ne sait pas mapper l'enum vers le schéma GraphQL.
 * Le nom 'TransactionType' sera utilisé dans le schéma généré.
 */
registerEnumType(TransactionType, { name: 'TransactionType' });

/*
 * CreatedBy : enum représentant qui a créé la transaction.
 * SYSTEM : transaction automatique (ex: ALLOWANCE via cron).
 * CHILD : transaction créée par l'enfant (ex: dépense manuelle).
 * PARENT : transaction créée par un parent (ex: recharge, dépense forcée).
 */
export enum CreatedBy {
  SYSTEM = 'SYSTEM',
  CHILD = 'CHILD',
  PARENT = 'PARENT',
}

registerEnumType(CreatedBy, { name: 'CreatedBy' });

/*
 * Transaction : entité représentant une transaction sur le compte d'un enfant.
 *
 * @Entity() + @ObjectType() : mappe sur la table PostgreSQL "transaction" ET expose
 * le type GraphQL "Transaction" dans le schéma (approche code-first, voir §3).
 *
 * Champs DB (PROJECT_CONTEXT.md §4) :
 *   id, childId, amount, type, label, category, createdAt, createdBy
 *
 * Règles métier :
 *   - amount : positif = crédit (RECHARGE, ALLOWANCE, MISSION_REWARD...),
 *     négatif = débit (EXPENSE, POT_WITHDRAWAL...).
 *   - createdBy : indique l'acteur à l'origine de la transaction (pour l'audit).
 *   - label et category sont optionnels (nullable en DB et GraphQL).
 */
@ObjectType()
@Entity()
export class Transaction {
  /*
   * @PrimaryGeneratedColumn('uuid') : clé primaire auto-générée (UUID v4).
   * @Field(() => ID) : expose ce champ dans le schéma GraphQL avec le type ID.
   */
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /*
   * Relation ManyToOne vers User (l'enfant propriétaire du compte).
   * @ManyToOne(() => User) : un User (role=CHILD) peut avoir plusieurs Transaction.
   * @JoinColumn({ name: 'childId' }) : crée la colonne "childId" en base,
   * clé étrangère vers user.id.
   * lazy: true → chargement paresseux de la relation.
   *
   * @Field(() => User) : expose le user dans le schéma GraphQL.
   */
  @Field(() => User)
  @ManyToOne(() => User, { lazy: true })
  @JoinColumn({ name: 'childId' })
  child: Promise<User>;

  /*
   * childId : colonne stockant l'ID de l'enfant (User avec role=CHILD).
   * Non exposé en GraphQL car redondant avec child (le resolver peut charger
   * le user complet si le client demande child { id }).
   */
  @Column({ type: 'uuid' })
  childId: string;

  /*
   * amount : montant de la transaction en euros.
   * @Column({ type: 'float' }) : nombre à virgule pour les montants décimaux.
   * @Field() : exposé en GraphQL (type Float non-null).
   *
   * Règle métier :
   *   - Positif pour les crédits (RECHARGE, ALLOWANCE, MISSION_REWARD...).
   *   - Négatif pour les débits (EXPENSE, POT_WITHDRAWAL...).
   */
  @Field()
  @Column({ type: 'float' })
  amount: number;

  /*
   * type : type de la transaction (voir enum TransactionType).
   * @Column({ type: 'enum', enum: TransactionType }) : stocke l'enum en PostgreSQL.
   * @Field(() => TransactionType) : expose le champ en GraphQL avec le type enum.
   */
  @Field(() => TransactionType)
  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  /*
   * label : libellé de la transaction (ex: "Recharge du 10/09", "Dépense chez McDo").
   * Optionnel → nullable en DB et GraphQL.
   */
  @Field({ nullable: true })
  @Column({ nullable: true })
  label?: string;

  /*
   * category : catégorie de la transaction (ex: "Fast-food", "Loisirs").
   * Optionnel → nullable en DB et GraphQL.
   */
  @Field({ nullable: true })
  @Column({ nullable: true })
  category?: string;

  /*
   * createdAt : date/heure de création de la transaction.
   * @CreateDateColumn() : TypeORM remplit automatiquement ce champ à l'insertion.
   * @Field() : exposé en GraphQL (type DateTime non-null, géré par @nestjs/graphql).
   */
  @Field()
  @CreateDateColumn()
  createdAt: Date;

  /*
   * createdBy : qui a créé la transaction (SYSTEM, CHILD, PARENT).
   * @Column({ type: 'enum', enum: CreatedBy }) : stocke l'enum en PostgreSQL.
   * @Field(() => CreatedBy) : exposé en GraphQL avec le type enum.
   */
  @Field(() => CreatedBy)
  @Column({ type: 'enum', enum: CreatedBy })
  createdBy: CreatedBy;
}
