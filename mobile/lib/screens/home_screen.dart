import 'dart:async';

import 'package:flutter/material.dart';
import 'package:graphql_flutter/graphql_flutter.dart';
import 'package:provider/provider.dart';

import '../graphql/child_operations.dart';
import '../models/child_account.dart';
import '../models/transaction.dart';
import '../services/auth_service.dart';
import '../services/notification_service.dart';
import '../utils/token_store.dart';
import 'tabs/balance_tab.dart';
import 'tabs/missions_tab.dart';
import 'tabs/pots_tab.dart';
import 'tabs/transactions_tab.dart';

/// Écran d'accueil de l'app enfant : scaffold avec bottom navigation à 4 onglets.
///
/// Onglets :
///  1. Solde       — balance + blocage carte
///  2. Opérations  — historique transactions + ajout dépense
///  3. Cagnottes   — liste + progression + retrait
///  4. Missions    — liste + marquer fait
///
/// Le `childId` (= user.id) est récupéré depuis [TokenStore] : le login
/// retourne déjà le user complet, pas besoin de rappeler `me`.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  // Subscriptions app-level : servent uniquement à afficher un SnackBar +
  // une notification OS quand une mise à jour temps réel arrive, quel que
  // soit l'onglet actif. Les onglets gardent leurs propres subscriptions
  // pour rafraîchir leur UI ; la double souscription (même WS, même data,
  // listeners différents) est sans incidence.
  StreamSubscription<QueryResult>? _balanceSub;
  StreamSubscription<QueryResult>? _txnSub;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _subscribeNotifications();
  }

  /// Souscrit à `balanceUpdated` et `transactionAdded` au niveau de HomeScreen
  /// (toujours monté tant que l'enfant est connecté) pour notifier app-wide.
  void _subscribeNotifications() {
    if (_balanceSub != null && _txnSub != null) return;

    final childId = context.read<TokenStore>().user?.id;
    if (childId == null) return;

    final client = GraphQLProvider.of(context).value;

    _balanceSub ??= client
        .subscribe(SubscriptionOptions(
          document: kBalanceUpdatedSubscription,
          variables: {'childId': childId},
        ))
        .listen((result) {
      final data = result.data?['balanceUpdated'];
      if (data == null) return;
      final account = ChildAccount.fromJson(data as Map<String, dynamic>);
      final msg = 'Solde mis à jour : ${account.balance.toStringAsFixed(2)} €';
      _notify(msg, 'Solde : ${account.balance.toStringAsFixed(2)} €');
    });

    _txnSub ??= client
        .subscribe(SubscriptionOptions(
          document: kTransactionAddedSubscription,
          variables: {'childId': childId},
        ))
        .listen((result) {
      final data = result.data?['transactionAdded'];
      if (data == null) return;
      final txn = Transaction.fromJson(data as Map<String, dynamic>);
      final sign = txn.isCredit ? '+' : '';
      final msg =
          '${txn.label ?? txn.type} : $sign${txn.amount.toStringAsFixed(2)} €';
      _notify(
          msg, '${txn.label ?? txn.type} $sign${txn.amount.toStringAsFixed(2)} €');
    });
  }

  /// Affiche à la fois un SnackBar in-app et une notification OS-level.
  void _notify(String snackBarText, String notifBody) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(snackBarText)));
    NotificationService.instance.show('FamilyPay', notifBody);
  }

  @override
  void dispose() {
    _balanceSub?.cancel();
    _txnSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokenStore = context.watch<TokenStore>();
    final authService = context.read<AuthService>();
    final childId = tokenStore.user?.id;

    // Tant qu'on n'a pas de childId (ne devrait pas arriver après login),
    // on affiche un écran d'erreur plutôt que de planter.
    if (childId == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('FamilyPay')),
        body: const Center(child: Text('Session invalide')),
      );
    }

    final tabs = [
      BalanceTab(childId: childId),
      TransactionsTab(childId: childId),
      PotsTab(childId: childId),
      MissionsTab(childId: childId),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('FamilyPay'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Déconnexion',
            onPressed: authService.logout,
          ),
        ],
      ),
      body: tabs[_currentIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() => _currentIndex = index);
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.account_balance_wallet),
            label: 'Solde',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long),
            label: 'Ops',
          ),
          NavigationDestination(
            icon: Icon(Icons.savings),
            label: 'Cagnottes',
          ),
          NavigationDestination(
            icon: Icon(Icons.task_alt),
            label: 'Missions',
          ),
        ],
      ),
    );
  }
}
