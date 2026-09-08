import 'dart:async';

import 'package:flutter/material.dart';
import 'package:graphql_flutter/graphql_flutter.dart';
import 'package:provider/provider.dart';

import '../graphql/child_operations.dart';
import '../models/child_account.dart';
import '../models/transaction.dart';
import '../services/auth_service.dart';
import '../services/lock_service.dart';
import '../utils/token_store.dart';
import 'tabs/home_tab.dart';
import 'tabs/missions_tab.dart';
import 'tabs/pots_tab.dart';
import 'tabs/transactions_tab.dart';
import 'settings_screen.dart';

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

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  int _currentIndex = 0;

  // Subscriptions app-level : servent uniquement à afficher un SnackBar quand
  // une mise à jour temps réel arrive, quel que soit l'onglet actif. Les onglets
  // gardent leurs propres subscriptions pour rafraîchir leur UI ; la double
  // souscription (même WS, même data, listeners différents) est sans incidence.
  StreamSubscription<QueryResult>? _balanceSub;
  StreamSubscription<QueryResult>? _txnSub;
  StreamSubscription<QueryResult>? _cardSub;
  StreamSubscription<QueryResult>? _potSub;

  // Debounce des SnackBars : addTransaction publie balanceUpdated ET
  // transactionAdded au même instant, ce qui déclenchait deux SnackBars. On
  // accumule les messages dans [_pendingMessages] et attend 500ms sans nouvel
  // événement avant d'en afficher un seul (messages joints par « · »).
  final List<String> _pendingMessages = [];
  Timer? _debounceTimer;

  @override
  void initState() {
    super.initState();
    // On s'enregistre comme observer du cycle de vie de l'app pour pouvoir
    // re-verrouiller (LockService.lock) quand l'app passe en arrière-plan.
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Quand l'app passe en arrière-plan, on re-verrouille : à son retour,
    // l'utilisateur devra ressaisir son PIN (ou utiliser la biométrie).
    if (state == AppLifecycleState.paused) {
      context.read<LockService>().lock();
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _subscribeNotifications();
  }

  /// Souscrit à `balanceUpdated`, `transactionAdded`, `cardBlocked` et
  /// `potUpdated` au niveau de HomeScreen (toujours monté tant que l'enfant
  /// est connecté) pour notifier app-wide.
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
      _queueMessage('Solde : ${account.balance.toStringAsFixed(2)} €');
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
      _queueMessage(
          '${txn.label ?? txn.type} : $sign${txn.amount.toStringAsFixed(2)} €');
    });

    _cardSub ??= client
        .subscribe(SubscriptionOptions(
          document: kCardBlockedSubscription,
          variables: {'childId': childId},
        ))
        .listen((result) {
      final data = result.data?['cardBlocked'];
      if (data == null) return;
      // La subscription ne demande que id/blocked/blockedBy (pas balance),
      // donc on ne passe pas par ChildAccount.fromJson qui attend `balance`.
      final blocked = data['blocked'] as bool? ?? false;
      final blockedBy = data['blockedBy'] as String?;
      if (blocked) {
        final byParent = blockedBy == 'PARENT' ? ' par un parent' : '';
        _queueMessage('Carte bloquée$byParent');
      } else {
        _queueMessage('Carte débloquée');
      }
    });

    _potSub ??= client
        .subscribe(SubscriptionOptions(
          document: kPotUpdatedSubscription,
          variables: {'childId': childId},
        ))
        .listen((result) {
      final data = result.data?['potUpdated'];
      if (data == null) return;
      final pot = data as Map<String, dynamic>;
      final title = pot['title'] as String? ?? 'Cagnotte';
      final current = (pot['currentAmount'] as num).toDouble();
      final target = (pot['targetAmount'] as num).toDouble();
      _queueMessage(
          'Cagnotte « $title » : ${current.toStringAsFixed(2)} € / ${target.toStringAsFixed(2)} €');
    });
  }

  /// Ajoute un message à la file d'attente et (re)démarre le timer de
  /// debounce de 500ms. Quand le timer se déclenche (aucun nouvel événement
  /// pendant 500ms), tous les messages en attente sont fusionnés en un
  /// seul SnackBar. Cela évite d'afficher deux SnackBars quand
  /// `addTransaction` publie `balanceUpdated` et `transactionAdded`
  /// simultanément.
  void _queueMessage(String message) {
    _pendingMessages.add(message);
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 500), _flushMessages);
  }

  /// Vide la file d'attente et affiche un SnackBar unique avec tous les
  /// messages accumulés, joints par « · ».
  void _flushMessages() {
    if (_pendingMessages.isEmpty) return;
    final text = _pendingMessages.join(' · ');
    _pendingMessages.clear();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _debounceTimer?.cancel();
    _balanceSub?.cancel();
    _txnSub?.cancel();
    _cardSub?.cancel();
    _potSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tokenStore = context.watch<TokenStore>();
    final authService = context.read<AuthService>();
    final lockService = context.read<LockService>();
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
      HomeTab(childId: childId),
      TransactionsTab(childId: childId),
      PotsTab(childId: childId),
      MissionsTab(childId: childId),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('FamilyPay'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            tooltip: 'Réglages',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const SettingsScreen()),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Déconnexion',
            onPressed: () async {
              // La déconnexion efface la session ET le code PIN : au prochain
              // login, l'utilisateur devra recréer un PIN.
              await lockService.clearPin();
              await authService.logout();
            },
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
