import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Field, ID, ObjectType } from '@nestjs/graphql';
import { User } from './user.entity.js';

/*
 * Note : User et Family se référencent mutuellement (relation 1-N bidirectionnelle).
 * En ESM, un import normal suffit car le cycle est résolu au runtime par le loader.
 * On n'utilise pas `import type` car @OneToMany(() => User) a besoin de la valeur
 * réelle de la classe User (pas juste le type).
 */

/*
 * Family : entité représentant une famille.
 *
 * @Entity() (TypeORM) : mappe cette classe sur une table PostgreSQL "family".
 * @ObjectType() (GraphQL) : expose ce type dans le schéma GraphQL généré.
 *
 * Les deux décorateurs sur la même classe évitent de dupliquer le modèle entre
 * TypeORM et GraphQL (voir PROJECT_CONTEXT.md §3). C'est l'approche code-first.
 *
 * Une famille est un groupe fermé de 1-2 parents + N enfants (PROJECT_CONTEXT.md §4).
 */
@ObjectType()
@Entity()
export class Family {
  /*
   * @PrimaryGeneratedColumn('uuid') : clé primaire auto-générée (UUID v4).
   * On utilise un UUID plutôt qu'un auto-incrément : pas de séquence, pas de
   * contention, et l'identifiant est opaque (pas devinable).
   *
   * @Field(() => ID) : expose ce champ dans le schéma GraphQL avec le type ID
   * (un identifiant unique sérialisé en string en GraphQL).
   */
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /*
   * @Column() : colonne string non-null dans PostgreSQL.
   * @Field() : expose le nom dans le schéma GraphQL (type String non-null).
   */
  @Field()
  @Column()
  name: string;

  /*
   * @OneToMany(() => User, (user) => user.family) : relation 1-N vers User.
   * Le 1er argument indique le type cible, le 2e la propriété inverse dans User.
   * lazy: true → la relation n'est chargée que si on y accède (évite de tout
   * charger en mémoire par défaut).
   *
   * Non exposé en GraphQL pour l'instant (le schéma §6 ne liste pas family.users).
   * On garde la relation côté DB mais on ne la met pas dans le schéma.
   */
  @OneToMany(() => User, (user) => user.family, { lazy: true })
  users: Promise<User[]>;
}
