import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
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
