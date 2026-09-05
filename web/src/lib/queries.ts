// Documents GraphQL partagés pour l'espace parent.
//
// Centralisés ici pour éviter la duplication entre les Server Components
// (via serverGraphQL) et les Client Components (via Apollo Client). Les types
// TypeScript associés sont déclarés à côté de chaque document.

import type { AppUser } from './auth-operations';

// Type BlockActor : qui a bloqué la carte (PARENT ou CHILD), ou null si non
// bloquée. Conforme à l'enum backend BlockActor.
export type BlockActor = 'PARENT' | 'CHILD';

// Type ChildAccount : compte d'un enfant (solde, état de blocage).
// `userId` n'est pas exposé directement en GraphQL — on passe par `user.id`.
export type ChildAccountSummary = {
  id: string;
  balance: number;
  blocked: boolean;
  blockedBy: BlockActor | null;
  user: AppUser;
};

// Query myChildren : liste des comptes enfants de la famille du parent.
// Côté serveur (serverGraphQL) — le JWT est lu depuis le cookie httpOnly.
export const MY_CHILDREN_QUERY = /* GraphQL */ `
  query MyChildren {
    myChildren {
      id
      balance
      blocked
      blockedBy
      user {
        id
        email
        role
        firstName
        lastName
      }
    }
  }
`;

// Query childAccount : compte détaillé d'un enfant (solde, blocage).
// `childId` est l'ID du User enfant (role=CHILD), pas l'ID du ChildAccount.
export const CHILD_ACCOUNT_QUERY = /* GraphQL */ `
  query ChildAccount($childId: ID!) {
    childAccount(childId: $childId) {
      id
      balance
      blocked
      blockedBy
      user {
        id
        email
        role
        firstName
        lastName
      }
    }
  }
`;
