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

// Type WithdrawalPolicy : politique de retrait d'une cagnotte (enum backend).
export type WithdrawalPolicy = 'ANYTIME' | 'WHEN_FULL' | 'PARENT_ONLY';

export type Pot = {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  publicToken: string;
  hiddenFrom: string[];
  withdrawalPolicy: WithdrawalPolicy;
};

// Query pots : liste les cagnottes d'un enfant.
export const POTS_QUERY = /* GraphQL */ `
  query Pots($childId: ID!) {
    pots(childId: $childId) {
      id
      title
      targetAmount
      currentAmount
      publicToken
      hiddenFrom
      withdrawalPolicy
    }
  }
`;

// Mutation createPot : un parent crée une cagnotte.
export const CREATE_POT_MUTATION = /* GraphQL */ `
  mutation CreatePot(
    $childId: ID!
    $title: String!
    $targetAmount: Float!
    $withdrawalPolicy: WithdrawalPolicy!
  ) {
    createPot(
      childId: $childId
      title: $title
      targetAmount: $targetAmount
      withdrawalPolicy: $withdrawalPolicy
    ) {
      id
      title
      targetAmount
      currentAmount
      publicToken
      withdrawalPolicy
    }
  }
`;

// Mutation withdrawFromPot : retire d'une cagnotte (parent toujours autorisé).
export const WITHDRAW_FROM_POT_MUTATION = /* GraphQL */ `
  mutation WithdrawFromPot($potId: ID!, $amount: Float!) {
    withdrawFromPot(potId: $potId, amount: $amount) {
      id
      amount
      type
      createdAt
    }
  }
`;

// Mutation contributeToPotPublic : don public SANS auth (@Public côté backend).
// Appelée depuis la page /donate/[token] via le proxy /api/graphql sans JWT.
export const CONTRIBUTE_TO_POT_PUBLIC_MUTATION = /* GraphQL */ `
  mutation ContributeToPotPublic(
    $publicToken: String!
    $amount: Float!
    $contributorName: String
  ) {
    contributeToPotPublic(
      publicToken: $publicToken
      amount: $amount
      contributorName: $contributorName
    ) {
      id
      amount
      contributorName
    }
  }
`;

// Type MissionStatus : cycle de vie d'une mission (enum backend).
export type MissionStatus =
  | 'PENDING'
  | 'DONE_BY_CHILD'
  | 'VALIDATED'
  | 'REJECTED';

export type Mission = {
  id: string;
  title: string;
  reward: number;
  status: MissionStatus;
};

// Query missions : liste les missions d'un enfant.
export const MISSIONS_QUERY = /* GraphQL */ `
  query Missions($childId: ID!) {
    missions(childId: $childId) {
      id
      title
      reward
      status
    }
  }
`;

// Mutation createMission : un parent crée une mission pour un enfant.
export const CREATE_MISSION_MUTATION = /* GraphQL */ `
  mutation CreateMission($childId: ID!, $title: String!, $reward: Float!) {
    createMission(childId: $childId, title: $title, reward: $reward) {
      id
      title
      reward
      status
    }
  }
`;

// Mutation validateMission : un parent valide (approve=true) ou refuse
// (approve=false) une mission marquée faite par l'enfant (DONE_BY_CHILD).
export const VALIDATE_MISSION_MUTATION = /* GraphQL */ `
  mutation ValidateMission($missionId: ID!, $approve: Boolean!) {
    validateMission(missionId: $missionId, approve: $approve) {
      id
      title
      reward
      status
    }
  }
`;
