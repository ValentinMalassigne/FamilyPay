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

// Type TransactionType : conformes aux enums backend.
export type TransactionType =
  | 'RECHARGE'
  | 'ALLOWANCE'
  | 'EXPENSE'
  | 'MISSION_REWARD'
  | 'QUIZ_REWARD'
  | 'POT_CONTRIBUTION'
  | 'POT_WITHDRAWAL';

export type CreatedBy = 'SYSTEM' | 'CHILD' | 'PARENT';

export type Transaction = {
  id: string;
  childId: string;
  amount: number;
  type: TransactionType;
  label: string | null;
  category: string | null;
  createdAt: string;
  createdBy: CreatedBy;
};

// Query transactions : historique des transactions d'un enfant.
export const TRANSACTIONS_QUERY = /* GraphQL */ `
  query Transactions($childId: ID!) {
    transactions(childId: $childId) {
      id
      childId
      amount
      type
      label
      category
      createdAt
      createdBy
    }
  }
`;

// Mutation rechargeChildAccount : recharge manuelle ponctuelle par un parent.
export const RECHARGE_MUTATION = /* GraphQL */ `
  mutation RechargeChildAccount($childId: ID!, $amount: Float!) {
    rechargeChildAccount(childId: $childId, amount: $amount) {
      id
      amount
      type
      label
      createdAt
      createdBy
    }
  }
`;

// Mutation addManualExpense : dépense manuelle sur le compte d'un enfant.
export const ADD_MANUAL_EXPENSE_MUTATION = /* GraphQL */ `
  mutation AddManualExpense($childId: ID!, $amount: Float!, $label: String!) {
    addManualExpense(childId: $childId, amount: $amount, label: $label) {
      id
      amount
      type
      label
      createdAt
      createdBy
    }
  }
`;
