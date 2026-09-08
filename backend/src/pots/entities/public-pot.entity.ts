import { Field, ObjectType } from '@nestjs/graphql';
import { PotStatus } from './pot.entity.js';

/*
 * PublicPot : type GraphQL DÉDIÉ à la lecture publique d'une cagnotte
 * (page de don /donate/[token] côté web), exposé par la query publique
 * potByPublicToken.
 *
 * Pourquoi un type séparé (sécurité — PROJECT_CONTEXT.md §8) :
 *   Le type Pot complet expose TOUS les champs via @Field : id, childId,
 *   hiddenFrom (liste d'IDs de parents masqués), publicToken, status. Retourner
 *   le Pot complet depuis une query @Public() laisserait un donateur externe
 *   sans JWT sonder des données internes (quel enfant possède la cagnotte,
 *   quels parents en sont masqués, l'ID interne en base). PublicPot n'expose
 *   QUE le strict minimum dont un donateur a besoin :
 *     - title / targetAmount / currentAmount : afficher le nom et la barre de
 *       progression sur la page de don.
 *     - status : pour désactiver le formulaire si la cagnotte est CLOSED.
 *   Le resolver potByPublicToken mappe manuellement le Pot vers ce type
 *   réduit. Le type Pot authentifié (query pots(childId)) reste inchangé.
 *
 * @ObjectType() : déclare une classe comme type GraphQL du schéma (code-first).
 *   Contrairement à Pot, PublicPot n'est PAS une @Entity() TypeORM : c'est un
 *   type de projection en lecture seule, sans table en base. Aucune colonne,
 *   aucune persistance — on le construit à la main dans le resolver à partir
 *   de l'entité Pot chargée par le service.
 *
 * @Field() : expose chaque propriété de la classe comme un champ GraphQL.
 *   @Field(() => PotStatus) est requis pour le champ status : sans typage
 *   explicite, reflect-metadata infère String et génère `status: String!`
 *   au lieu de `status: PotStatus!` (même classe de bug que pour les args ID —
 *   voir pot.entity.ts).
 */
@ObjectType()
export class PublicPot {
  @Field() title: string;
  @Field() targetAmount: number;
  @Field() currentAmount: number;
  @Field(() => PotStatus) status: PotStatus;
}
