import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { User } from '../../users/entities/user.entity.js';

/*
 * WithdrawalPolicy : enum représentant la politique de retrait d'une cagnotte
 * (PROJECT_CONTEXT.md §4 — règle métier "retrait de cagnotte").
 *
 * ANYTIME    : l'enfant peut retirer librement, à tout moment.
 * WHEN_FULL  : l'enfant ne peut retirer que quand currentAmount >= targetAmount.
 * PARENT_ONLY: l'enfant ne peut JAMAIS retirer lui-même — seul un parent peut
 *              transférer l'argent de la cagnotte vers le solde principal.
 *
 * Dans TOUS les cas, un parent peut effectuer le retrait lui-même (le guard de
 * la mutation withdrawFromPot distingue l'appelant : enfant → vérifier la
 * policy ; parent → toujours autorisé).
 */
export enum WithdrawalPolicy {
  ANYTIME = 'ANYTIME',
  WHEN_FULL = 'WHEN_FULL',
  PARENT_ONLY = 'PARENT_ONLY',
}

/*
 * registerEnumType : enregistre l'enum TypeScript comme type enum GraphQL.
 * Le nom 'WithdrawalPolicy' sera utilisé dans le schéma généré.
 */
registerEnumType(WithdrawalPolicy, { name: 'WithdrawalPolicy' });

/*
 * Pot : entité représentant une cagnotte d'épargne d'un enfant.
 *
 * @Entity() + @ObjectType() : mappe sur la table PostgreSQL "pot" ET expose
 * le type GraphQL "Pot" dans le schéma (approche code-first, voir §3).
 *
 * Champs DB (PROJECT_CONTEXT.md §4) :
 *   id, childId, title, targetAmount, currentAmount, publicToken,
 *   hiddenFrom, withdrawalPolicy
 *
 * Règles métier :
 *   - currentAmount ne peut pas dépasser targetAmount (validé côté service à
 *     chaque contribution).
 *   - hiddenFrom : liste d'userId de parents à qui la cagnotte est masquée.
 *     Vide par défaut = visible par toute la famille. Permet par exemple une
 *     cagnotte "cadeau papa" masquée au père (hiddenFrom = [id du père]).
 *   - publicToken : UUID exposé dans l'URL de don public (page Next.js sans
 *     auth). Permet à un donateur externe de contribuer sans compte.
 */
@ObjectType()
@Entity()
export class Pot {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /*
   * Relation ManyToOne vers User (l'enfant propriétaire de la cagnotte).
   * @ManyToOne(() => User) : un User (role=CHILD) peut avoir plusieurs Pot.
   * @JoinColumn({ name: 'childId' }) : crée la colonne "childId" en base,
   * clé étrangère vers user.id.
   * lazy: true → chargement paresseux de la relation.
   *
   * Pas de @Field : la relation n'est pas exposée en GraphQL. Le schéma §6
   * expose childId implicitement via la mutation createPot(childId: ID!).
   * On expose childId (l'ID brut) ci-dessous pour rester aligné avec le
   * contrat partagé avec web/mobile.
   */
  @ManyToOne(() => User, { lazy: true })
  @JoinColumn({ name: 'childId' })
  child: Promise<User>;

  @Field(() => ID)
  @Column({ type: 'uuid' })
  childId: string;

  /*
   * title : nom de la cagnotte (ex: "Nouveau vélo", "Cadeau papa").
   */
  @Field()
  @Column()
  title: string;

  /*
   * targetAmount : objectif de la cagnotte en euros (ex: 200 pour 200€).
   * La cagnotte est "pleine" quand currentAmount >= targetAmount.
   */
  @Field()
  @Column({ type: 'float' })
  targetAmount: number;

  /*
   * currentAmount : montant actuellement accumulé dans la cagnotte.
   * Mis à jour à chaque contribution (+) et chaque retrait (-).
   * Ne peut pas dépasser targetAmount (validé côté service).
   */
  @Field()
  @Column({ type: 'float', default: 0 })
  currentAmount: number;

  /*
   * publicToken : UUID exposé dans l'URL de don public. Permet à un donateur
   * externe de contribuer sans authentification (mutation contributeToPotPublic).
   * Généré via crypto.randomUUID() à la création du pot.
   *
   * @Column({ type: 'uuid', unique: true }) : un seul pot par token (recherche
   * par token via getPotByPublicToken).
   */
  @Field()
  @Column({ type: 'uuid', unique: true })
  publicToken: string;

  /*
   * hiddenFrom : liste d'userId de parents à qui la cagnotte est masquée.
   * @Column({ type: 'uuid', array: true, default: '{}' }) : array PostgreSQL
   * d'UUIDs, vide par défaut (= visible par toute la famille).
   *
   * Une cagnotte est toujours visible par l'enfant propriétaire. hiddenFrom
   * ne s'applique qu'aux parents (ex: cagnotte "cadeau papa" masquée au père).
   *
   * @Field(() => [ID]) : exposé en GraphQL comme liste d'IDs (schéma §6 :
   * hiddenFrom: [ID!]!).
   */
  @Field(() => [ID])
  @Column({ type: 'uuid', array: true, default: '{}' })
  hiddenFrom: string[];

  /*
   * withdrawalPolicy : politique de retrait (voir enum WithdrawalPolicy).
   * Défini par le parent à la création de la cagnotte.
   * @Column({ type: 'enum', enum: WithdrawalPolicy }) : enum natif PostgreSQL.
   * @Field(() => WithdrawalPolicy) : exposé en GraphQL avec le type enum.
   */
  @Field(() => WithdrawalPolicy)
  @Column({ type: 'enum', enum: WithdrawalPolicy })
  withdrawalPolicy: WithdrawalPolicy;
}
