import 'dart:async';

import 'package:flutter/material.dart';
import 'package:graphql_flutter/graphql_flutter.dart';

import '../../graphql/child_operations.dart';
import '../../models/child_account.dart';

/// Onglet Accueil : affiche le solde de l'enfant en grand + section blocage carte
/// + résumés (dernière opération, dernière cagnotte, dernière mission).
///
/// - `Query` `myChildAccount` → charge le solde initial.
/// - `Subscription` `balanceUpdated` → met à jour le solde en temps réel
///   sans recharger la query.
/// - `Subscription` `cardBlocked` → met à jour l'état de blocage de la carte
///   en temps réel (utile quand le parent bloque/débloque à distance).
/// - `Mutation` `setCardBlocked` → bloque/débloque la carte.
///
/// Si `blockedBy == "PARENT"` : le Switch est désactivé + message informatif.
/// Sinon (`"CHILD"` ou null) : l'enfant peut basculer le Switch.
class HomeTab extends StatefulWidget {
  const HomeTab({super.key, required this.childId});

  /// user.id de l'enfant (= childId pour tout le backend).
  final String childId;

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> {
  /// Compte courant : initialisé par la query, puis mis à jour par la
  /// subscription `balanceUpdated` (solde), la subscription `cardBlocked`
  /// (état de blocage) et la mutation `setCardBlocked`.
  ChildAccount? _account;
  StreamSubscription<QueryResult>? _balanceSub;
  StreamSubscription<QueryResult>? _cardSub;
  bool _toggling = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _subscribeBalance();
    _subscribeCardBlocked();
  }

  /// Souscrit à la subscription `balanceUpdated` via le client GraphQL brut.
  /// On utilise le client directement (pas le widget `Subscription`) pour
  /// pouvoir mettre à jour `_account` sans reconstruire tout le tree.
  void _subscribeBalance() {
    if (_balanceSub != null) return;

    final client = GraphQLProvider.of(context).value;
    _balanceSub = client
        .subscribe(SubscriptionOptions(
          document: kBalanceUpdatedSubscription,
          variables: {'childId': widget.childId},
        ))
        .listen((result) {
          if (result.data != null && result.data!['balanceUpdated'] != null) {
            final updated =
                ChildAccount.fromJson(result.data!['balanceUpdated']);
            if (mounted) setState(() => _account = updated);
          }
        });
  }

  /// Souscrit à la subscription `cardBlocked` pour mettre à jour l'état du
  /// switch en temps réel quand le parent bloque/débloque la carte à distance.
  /// La subscription ne renvoie que id/blocked/blockedBy (pas balance), donc
  /// on fusionne avec le `_account` existant pour ne pas perdre le solde.
  void _subscribeCardBlocked() {
    if (_cardSub != null) return;

    final client = GraphQLProvider.of(context).value;
    _cardSub = client
        .subscribe(SubscriptionOptions(
          document: kCardBlockedSubscription,
          variables: {'childId': widget.childId},
        ))
        .listen((result) {
          final data = result.data?['cardBlocked'];
          if (data == null) return;
          final blocked = data['blocked'] as bool? ?? false;
          final blockedBy = data['blockedBy'] as String?;
          if (mounted) {
            setState(() {
              _account = ChildAccount(
                id: _account?.id ?? data['id'] as String,
                balance: _account?.balance ?? 0,
                blocked: blocked,
                blockedBy: blockedBy,
              );
            });
          }
        });
  }

  @override
  void dispose() {
    _balanceSub?.cancel();
    _cardSub?.cancel();
    super.dispose();
  }

  /// Bascule l'état bloqué de la carte via la mutation `setCardBlocked`.
  Future<void> _toggleBlocked(bool blocked) async {
    if (_toggling) return;
    setState(() => _toggling = true);

    final client = GraphQLProvider.of(context).value;
    try {
      final result = await client.mutate(MutationOptions(
        document: kSetCardBlockedMutation,
        variables: {'childId': widget.childId, 'blocked': blocked},
      ));

      if (result.hasException) {
        final errors = result.exception?.graphqlErrors;
        final msg = (errors != null && errors.isNotEmpty)
            ? errors.first.message
            : 'Erreur inconnue';
        if (mounted) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(msg)));
        }
      } else if (result.data != null &&
          result.data!['setCardBlocked'] != null) {
        final updated =
            ChildAccount.fromJson(result.data!['setCardBlocked']);
        if (mounted) setState(() => _account = updated);
      }
    } finally {
      if (mounted) setState(() => _toggling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Query(
      options: QueryOptions(document: kMyChildAccountQuery),
      builder: (result, {refetch, fetchMore}) {
        if (result.hasException && _account == null) {
          return const Center(child: Text('Erreur de chargement du solde'));
        }

        // Priorité : `_account` (mis à jour par subscription/mutation),
        // sinon les données de la query initiale.
        ChildAccount? account = _account;
        if (account == null &&
            result.data != null &&
            result.data!['myChildAccount'] != null) {
          account = ChildAccount.fromJson(result.data!['myChildAccount']);
        }

        if (account == null) {
          return const Center(child: CircularProgressIndicator());
        }

        return _buildContent(account);
      },
    );
  }

  Widget _buildContent(ChildAccount account) {
    final blockedByParent = account.blockedBy == 'PARENT';

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'Mon solde',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              '${account.balance.toStringAsFixed(2)} €',
              style: Theme.of(context).textTheme.displayMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: account.blocked ? Colors.grey : null,
                  ),
            ),
            const SizedBox(height: 40),
            // --- Section carte ---
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.credit_card, size: 32),
                        const SizedBox(width: 12),
                        Text(
                          'Ma carte',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          account.blocked ? 'Bloquée' : 'Active',
                          style: TextStyle(
                            color: account.blocked
                                ? Theme.of(context).colorScheme.error
                                : Colors.green,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Switch(
                          value: account.blocked,
                          // Désactivé si bloquée par un parent — seul un
                          // parent peut débloquer dans ce cas.
                          onChanged: blockedByParent || _toggling
                              ? null
                              : (value) => _toggleBlocked(value),
                        ),
                      ],
                    ),
                    if (blockedByParent)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          'Bloquée par un parent — seul un parent peut la débloquer',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: Theme.of(context).colorScheme.error,
                              ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
