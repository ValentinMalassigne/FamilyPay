import 'package:graphql_flutter/graphql_flutter.dart';

/// Documents GraphQL pour les fonctionnalités côté enfant (queries,
/// mutations, subscriptions).
///
/// `gql()` parse une chaîne GraphQL en `DocumentNode`, le format attendu
/// par `QueryOptions` / `MutationOptions` / `SubscriptionOptions`.

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/// Query `myChildAccount` : retourne le compte de l'enfant authentifié
/// (solde, état de blocage). Utilisée au chargement initial de l'onglet Solde.
final kMyChildAccountQuery = gql(r'''
  query MyChildAccount {
    myChildAccount {
      id
      balance
      blocked
      blockedBy
    }
  }
''');

/// Query `transactions` : historique des transactions de l'enfant.
final kTransactionsQuery = gql(r'''
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
''');

/// Query `pots` : liste des cagnottes de l'enfant.
final kPotsQuery = gql(r'''
  query Pots($childId: ID!) {
    pots(childId: $childId) {
      id
      title
      targetAmount
      currentAmount
      publicToken
      withdrawalPolicy
      status
    }
  }
''');

/// Query `missions` : liste des missions de l'enfant.
final kMissionsQuery = gql(r'''
  query Missions($childId: ID!) {
    missions(childId: $childId) {
      id
      title
      reward
      status
    }
  }
''');

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/// Mutation `addManualExpense` : ajoute une dépense manuelle (montant positif,
/// le backend convertit en négatif). `category` est optionnel.
final kAddManualExpenseMutation = gql(r'''
  mutation AddManualExpense($childId: ID!, $amount: Float!, $label: String!, $category: String) {
    addManualExpense(childId: $childId, amount: $amount, label: $label, category: $category) {
      id
      amount
      type
      label
      category
      createdAt
    }
  }
''');

/// Mutation `markMissionDone` : l'enfant marque une mission comme faite
/// (PENDING → DONE_BY_CHILD).
final kMarkMissionDoneMutation = gql(r'''
  mutation MarkMissionDone($missionId: ID!) {
    markMissionDone(missionId: $missionId) {
      id
      title
      reward
      status
    }
  }
''');

/// Mutation `setCardBlocked` : bloque ou débloque la carte. Le backend
/// rejette si l'enfant tente de débloquer une carte bloquée par un parent.
final kSetCardBlockedMutation = gql(r'''
  mutation SetCardBlocked($childId: ID!, $blocked: Boolean!) {
    setCardBlocked(childId: $childId, blocked: $blocked) {
      id
      balance
      blocked
      blockedBy
    }
  }
''');

/// Mutation `withdrawFromPot` : retire l'intégralité du montant accumulé
/// d'une cagnotte. `amount` DOIT être égal à `currentAmount` (retrait total
/// obligatoire). La cagnotte est clôturée après le retrait.
final kWithdrawFromPotMutation = gql(r'''
  mutation WithdrawFromPot($potId: ID!, $amount: Float!) {
    withdrawFromPot(potId: $potId, amount: $amount) {
      id
      amount
      type
    }
  }
''');

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

/// Subscription `balanceUpdated` : notifie en temps réel quand le solde
/// de l'enfant change. Retourne le ChildAccount mis à jour.
final kBalanceUpdatedSubscription = gql(r'''
  subscription BalanceUpdated($childId: ID!) {
    balanceUpdated(childId: $childId) {
      id
      balance
      blocked
      blockedBy
    }
  }
''');

/// Subscription `transactionAdded` : notifie en temps réel quand une nouvelle
/// transaction est créée pour l'enfant. Retourne la Transaction créée.
final kTransactionAddedSubscription = gql(r'''
  subscription TransactionAdded($childId: ID!) {
    transactionAdded(childId: $childId) {
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
''');
