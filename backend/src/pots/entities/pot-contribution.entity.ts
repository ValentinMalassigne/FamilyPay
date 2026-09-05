import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Pot } from './pot.entity.js';

/*
 * PotContribution : entité représentant une contribution (don) à une cagnotte.
 *
 * @Entity() + @ObjectType() : mappe sur la table PostgreSQL "pot_contribution"
 * ET expose le type GraphQL "PotContribution" dans le schéma.
 *
 * Champs DB (PROJECT_CONTEXT.md §4) :
 *   id, potId, amount, contributorName, createdAt, isPublicDonation
 *
 * Une contribution publique (via le lien, sans auth) crée une PotContribution
 * + une Transaction de type POT_CONTRIBUTION sur le compte de l'enfant.
 * Une contribution peut aussi être interne (parent qui ajoute de l'argent à
 * la cagnotte de son enfant) — isPublicDonation = false dans ce cas.
 */
@ObjectType()
@Entity()
export class PotContribution {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /*
   * Relation ManyToOne vers Pot : une cagnotte peut recevoir plusieurs
   * contributions. @JoinColumn({ name: 'potId' }) crée la colonne potId
   * (clé étrangère vers pot.id).
   */
  @ManyToOne(() => Pot, { lazy: true })
  @JoinColumn({ name: 'potId' })
  pot: Promise<Pot>;

  @Field(() => ID)
  @Column({ type: 'uuid' })
  potId: string;

  /*
   * amount : montant de la contribution en euros. Toujours positif.
   * Plafonné à targetAmount - currentAmount de la cagnotte (validé côté
   * service avant insertion).
   */
  @Field()
  @Column({ type: 'float' })
  amount: number;

  /*
   * contributorName : texte libre, optionnel. Pour les dons publics anonymes
   * (null) ou signés (ex: "Tante Sophie"). Permet d'afficher le nom du
   * donateur sans créer de compte utilisateur.
   */
  @Field({ nullable: true })
  @Column({ nullable: true })
  contributorName: string | null;

  /*
   * createdAt : date/heure de la contribution.
   * @CreateDateColumn() : TypeORM remplit automatiquement à l'insertion.
   */
  @Field()
  @CreateDateColumn()
  createdAt: Date;

  /*
   * isPublicDonation : true si la contribution vient du lien public (sans auth),
   * false si elle vient d'un utilisateur authentifié (parent).
   */
  @Field()
  @Column({ default: false })
  isPublicDonation: boolean;
}
