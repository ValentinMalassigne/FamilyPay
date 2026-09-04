import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../utils/token_store.dart';

/// Écran d'accueil (placeholder) affiché après connexion.
///
/// Affiche le prénom de l'utilisateur et un bouton de déconnexion.
/// Le contenu fonctionnel (solde, transactions, cagnottes...) viendra
/// sur les branches feat/mobile-* à venir.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final tokenStore = context.watch<TokenStore>();
    final authService = context.read<AuthService>();
    final user = tokenStore.user;

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
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'Bienvenue ${user?.firstName ?? ''}',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 8),
            Text(
              user?.email ?? '',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 32),
            const Text(
              'Écran d\'accueil — fonctionnalités à venir',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }
}
