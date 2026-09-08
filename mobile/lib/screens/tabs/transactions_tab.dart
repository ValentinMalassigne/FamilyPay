import 'dart:async';

import 'package:flutter/material.dart';
import 'package:graphql_flutter/graphql_flutter.dart';

import '../../graphql/child_operations.dart';
import '../../models/transaction.dart';
import 'add_expense_screen.dart';

/// Onglet Opérations : historique des transactions + ajout de dépense.
///
/// - `Query` `transactions` → liste des transactions (ListView).
/// - `Subscription` `transactionAdded` → déclenche un refetch de la query
///   quand une nouvelle transaction arrive.
/// - FAB "+" → ouvre [AddExpenseScreen].
class TransactionsTab extends StatefulWidget {
  const TransactionsTab({super.key, required this.childId});

  final String childId;

  @override
  State<TransactionsTab> createState() => _TransactionsTabState();
}

class _TransactionsTabState extends State<TransactionsTab> {
  /// Callback de refetch stockée depuis le builder du widget `Query`.
  /// Appelée quand la subscription `transactionAdded` se déclenche.
  VoidCallback? _refetch;
  StreamSubscription<QueryResult>? _txnSub;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _subscribeTransactionAdded();
  }

  void _subscribeTransactionAdded() {
    if (_txnSub != null) return;

    final client = GraphQLProvider.of(context).value;
    _txnSub = client
        .subscribe(SubscriptionOptions(
          document: kTransactionAddedSubscription,
          variables: {'childId': widget.childId},
        ))
        .listen((result) {
          if (result.data != null &&
              result.data!['transactionAdded'] != null) {
            // Une nouvelle transaction est arrivée : refetch la query
            // pour rafraîchir la liste complète.
            _refetch?.call();
          }
        });
  }

  @override
  void dispose() {
    _txnSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Query(
        options: QueryOptions(
          document: kTransactionsQuery,
          variables: {'childId': widget.childId},
        ),
        builder: (result, {refetch, fetchMore}) {
          // Stocke le callback de refetch pour la subscription.
          _refetch = refetch;

          if (result.hasException) {
            return const Center(
                child: Text('Erreur de chargement des transactions'));
          }

          if (result.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          final list = result.data?['transactions'] as List<dynamic>?;
          if (list == null || list.isEmpty) {
            return _buildEmpty(context);
          }

          final transactions = list
              .map((e) => Transaction.fromJson(e as Map<String, dynamic>))
              .toList();

          return _buildList(transactions);
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => AddExpenseScreen(childId: widget.childId),
            ),
          );
        },
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildEmpty(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.receipt_long, size: 64, color: Colors.grey),
          const SizedBox(height: 16),
          Text(
            'Aucune transaction',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          const Text(
            'Ajoute une première dépense avec le bouton +',
            style: TextStyle(color: Colors.grey),
          ),
        ],
      ),
    );
  }

  Widget _buildList(List<Transaction> transactions) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: transactions.length,
      itemBuilder: (context, index) {
        final txn = transactions[index];
        return _TransactionTile(transaction: txn);
      },
    );
  }
}

/// Tuile d'une transaction dans la liste.
class _TransactionTile extends StatelessWidget {
  const _TransactionTile({required this.transaction});

  final Transaction transaction;

  @override
  Widget build(BuildContext context) {
    final isCredit = transaction.isCredit;

    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: isCredit
              ? Colors.green.withValues(alpha: 0.15)
              : Colors.red.withValues(alpha: 0.15),
          child: Icon(
            isCredit ? Icons.add : Icons.remove,
            color: isCredit ? Colors.green : Colors.red,
          ),
        ),
        title: Text(transaction.label ?? transaction.type),
        subtitle: Text([
          if (transaction.category != null) transaction.category!,
          _formatDate(transaction.createdAt),
        ].join(' · ')),
        trailing: Text(
          '${isCredit ? '+' : ''}${transaction.amount.toStringAsFixed(2)} €',
          style: TextStyle(
            color: isCredit ? Colors.green : Colors.red,
            fontWeight: FontWeight.w600,
            fontSize: 16,
          ),
        ),
      ),
    );
  }

  String _formatDate(String isoDate) {
    final dt = DateTime.tryParse(isoDate);
    if (dt == null) return isoDate;
    return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }
}
