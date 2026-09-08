import 'dart:async';

import 'package:flutter/material.dart';
import 'package:graphql_flutter/graphql_flutter.dart';

import '../../graphql/child_operations.dart';
import '../../models/child_account.dart';
import '../../models/mission.dart';
import '../../models/pot.dart';
import '../../models/transaction.dart';
import 'add_expense_screen.dart';

/// Onglet Accueil : affiche le solde de l'enfant en grand + section blocage carte
/// + résumés (dernière opération, dernière cagnotte, dernière mission).
///
/// - `Query` `myChildAccount` → charge le solde initial.
/// - `Subscription` `balanceUpdated` → met à jour le solde en temps réel
///   sans recharger la query.
/// - `Subscription` `cardBlocked` → met à jour l'état de blocage de la carte
///   en temps réel (utile quand le parent bloque/débloque à distance).
/// - `Mutation` `setCardBlocked` → bloque/débloque la carte.
/// - `Query` `transactions` / `pots` / `missions` → chargent les premiers
///   éléments de chaque liste pour afficher les résumés (dernière opération,
///   dernière cagnotte, dernière mission).
/// - `Subscription` `transactionAdded` / `potUpdated` → rafraîchissent les
///   résumés quand une nouvelle transaction arrive ou qu'une cagnotte change.
///
/// Si `blockedBy == "PARENT"` : le Switch est désactivé + message informatif.
/// Sinon (`"CHILD"` ou null) : l'enfant peut basculer le Switch.
class HomeTab extends StatefulWidget {
  const HomeTab({
    super.key,
    required this.childId,
    required this.onNavigateToTab,
  });

  /// user.id de l'enfant (= childId pour tout le backend).
  final String childId;

  /// Callback pour basculer d'onglet au tap sur une carte de résumé
  /// (0 = Accueil, 1 = Ops, 2 = Cagnottes, 3 = Missions).
  final ValueChanged<int> onNavigateToTab;

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

  /// Résumés : dernier élément de chaque liste (transactions, pots, missions).
  /// Null tant qu'aucun élément n'a été trouvé (liste vide ou non chargée).
  Transaction? _lastTxn;
  Pot? _lastPot;
  Mission? _lastMission;
  bool _loadingSummaries = false;
  StreamSubscription<QueryResult>? _txnSub;
  StreamSubscription<QueryResult>? _potSub;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _subscribeBalance();
    _subscribeCardBlocked();
    _fetchSummaries();
    _subscribeTransactionAdded();
    _subscribePotUpdated();
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

  /// Lance en parallèle (Future.wait) les queries `transactions`, `pots` et
  /// `missions`, puis stocke le premier élément de chaque liste comme
  /// « dernière opération / cagnotte / mission ».
  ///
  /// Ordre côté backend : transactions et missions sont triées `createdAt DESC`
  /// (premier élément = plus récent). Les pots ne sont pas triés (le type
  /// GraphQL `Pot` n'expose pas `createdAt`) — on prend le premier de la
  /// liste comme approximation.
  Future<void> _fetchSummaries() async {
    if (_loadingSummaries) return;

    setState(() => _loadingSummaries = true);

    final client = GraphQLProvider.of(context).value;
    final variables = {'childId': widget.childId};

    try {
      final results = await Future.wait([
        client.query(QueryOptions(
          document: kTransactionsQuery,
          variables: variables,
        )),
        client.query(QueryOptions(
          document: kPotsQuery,
          variables: variables,
        )),
        client.query(QueryOptions(
          document: kMissionsQuery,
          variables: variables,
        )),
      ]);

      if (!mounted) return;

      // transactions : premier élément = dernière opération.
      Transaction? lastTxn;
      final txnList = results[0].data?['transactions'] as List<dynamic>?;
      if (txnList != null && txnList.isNotEmpty) {
        lastTxn = Transaction.fromJson(txnList.first as Map<String, dynamic>);
      }

      // pots : premier élément (ordre non garanti, voir dartdoc).
      Pot? lastPot;
      final potList = results[1].data?['pots'] as List<dynamic>?;
      if (potList != null && potList.isNotEmpty) {
        lastPot = Pot.fromJson(potList.first as Map<String, dynamic>);
      }

      // missions : premier élément = dernière mission.
      Mission? lastMission;
      final missionList = results[2].data?['missions'] as List<dynamic>?;
      if (missionList != null && missionList.isNotEmpty) {
        lastMission =
            Mission.fromJson(missionList.first as Map<String, dynamic>);
      }

      setState(() {
        _lastTxn = lastTxn;
        _lastPot = lastPot;
        _lastMission = lastMission;
      });
    } finally {
      if (mounted) setState(() => _loadingSummaries = false);
    }
  }

  /// Souscrit à la subscription `transactionAdded` : à chaque nouvelle
  /// transaction, on refetch les résumés (la dernière opération change).
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
            _fetchSummaries();
          }
        });
  }

  /// Souscrit à la subscription `potUpdated` : quand une cagnotte reçoit un
  /// don, on refetch les résumés (la dernière cagnotte peut changer).
  void _subscribePotUpdated() {
    if (_potSub != null) return;

    final client = GraphQLProvider.of(context).value;
    _potSub = client
        .subscribe(SubscriptionOptions(
          document: kPotUpdatedSubscription,
          variables: {'childId': widget.childId},
        ))
        .listen((result) {
          if (result.data != null && result.data!['potUpdated'] != null) {
            _fetchSummaries();
          }
        });
  }

  @override
  void dispose() {
    _balanceSub?.cancel();
    _cardSub?.cancel();
    _txnSub?.cancel();
    _potSub?.cancel();
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

  /// Ouvre l'écran d'ajout de dépense. Au retour, refetch les résumés (la
  /// nouvelle transaction devient la dernière opération).
  Future<void> _openAddExpense() async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => AddExpenseScreen(childId: widget.childId),
      ),
    );
    // La subscription transactionAdded déclenchera aussi un refetch, mais on
    // le fait ici aussi pour le cas où l'utilisateur annule sans ajouter.
    if (mounted) _fetchSummaries();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Query(
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
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _openAddExpense,
        tooltip: 'Nouvelle dépense',
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildContent(ChildAccount account) {
    final blockedByParent = account.blockedBy == 'PARENT';

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 16),
            // --- Section solde ---
            Text(
              'Mon solde',
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              '${account.balance.toStringAsFixed(2)} €',
              style: Theme.of(context).textTheme.displayMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: account.blocked ? Colors.grey : null,
                  ),
              textAlign: TextAlign.center,
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
            const SizedBox(height: 24),
            // --- Résumés ---
            _buildLastTransactionCard(),
            const SizedBox(height: 12),
            _buildLastPotCard(),
            const SizedBox(height: 12),
            _buildLastMissionCard(),
            const SizedBox(height: 80),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Cartes de résumé
  // ---------------------------------------------------------------------------

  /// Dernière opération : libellé + montant coloré (crédit/débit) + date.
  /// Tap → onglet Ops (index 1).
  Widget _buildLastTransactionCard() {
    final txn = _lastTxn;
    final title = 'Dernière opération';

    if (txn == null) {
      return _SummaryPlaceholderCard(
        icon: Icons.receipt_long,
        title: title,
        emptyText: 'Aucune opération',
        onTap: () => widget.onNavigateToTab(1),
      );
    }

    final isCredit = txn.isCredit;
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
        title: Text(txn.label ?? txn.type),
        subtitle: Text(_formatDate(txn.createdAt)),
        trailing: Text(
          '${isCredit ? '+' : ''}${txn.amount.toStringAsFixed(2)} €',
          style: TextStyle(
            color: isCredit ? Colors.green : Colors.red,
            fontWeight: FontWeight.w600,
            fontSize: 16,
          ),
        ),
        onTap: () => widget.onNavigateToTab(1),
      ),
    );
  }

  /// Dernière cagnotte : titre + currentAmount / targetAmount + barre de
  /// progression. Tap → onglet Cagnottes (index 2).
  Widget _buildLastPotCard() {
    final pot = _lastPot;
    final title = 'Dernière cagnotte';

    if (pot == null) {
      return _SummaryPlaceholderCard(
        icon: Icons.savings,
        title: title,
        emptyText: 'Aucune cagnotte',
        onTap: () => widget.onNavigateToTab(2),
      );
    }

    final progress = pot.progress.clamp(0.0, 1.0);
    return Card(
      child: InkWell(
        onTap: () => widget.onNavigateToTab(2),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.savings, size: 24),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      pot.title,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: LinearProgressIndicator(
                  value: progress,
                  minHeight: 10,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '${pot.currentAmount.toStringAsFixed(2)} € / ${pot.targetAmount.toStringAsFixed(2)} €',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Dernière mission : titre + récompense + badge de statut.
  /// Tap → onglet Missions (index 3).
  Widget _buildLastMissionCard() {
    final mission = _lastMission;
    final title = 'Dernière mission';

    if (mission == null) {
      return _SummaryPlaceholderCard(
        icon: Icons.task_alt,
        title: title,
        emptyText: 'Aucune mission',
        onTap: () => widget.onNavigateToTab(3),
      );
    }

    return Card(
      child: InkWell(
        onTap: () => widget.onNavigateToTab(3),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      mission.title,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  Text(
                    '+${mission.reward.toStringAsFixed(2)} €',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _missionStatusBadge(mission),
            ],
          ),
        ),
      ),
    );
  }

  /// Badge de statut d'une mission (mêmes libellés que MissionsTab).
  Widget _missionStatusBadge(Mission mission) {
    if (mission.isPending) {
      return _badge('En attente', Colors.orange);
    }
    if (mission.isDoneByChild) {
      return _badge('En attente de validation par un parent', Colors.blue);
    }
    if (mission.isValidated) {
      return _badge(
          'Validée +${mission.reward.toStringAsFixed(2)} €', Colors.green);
    }
    if (mission.isRejected) {
      return _badge('Refusée', Colors.red);
    }
    return const SizedBox.shrink();
  }

  Widget _badge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w600,
          fontSize: 13,
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

/// Carte de résumé affichée quand la liste correspondante est vide.
class _SummaryPlaceholderCard extends StatelessWidget {
  const _SummaryPlaceholderCard({
    required this.icon,
    required this.title,
    required this.emptyText,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String emptyText;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Icon(icon, size: 24, color: Colors.grey),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      emptyText,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Colors.grey,
                          ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: Colors.grey),
            ],
          ),
        ),
      ),
    );
  }
}
