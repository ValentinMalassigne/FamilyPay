import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/lock_service.dart';
import '../utils/token_store.dart';
import 'home_screen.dart';
import 'login_screen.dart';
import 'pin_lock_screen.dart';
import 'pin_setup_screen.dart';

/// Routeur d'authentification + verrouillage PIN.
///
/// Écoute [TokenStore] (état d'auth) et [LockService] (état du PIN) via
/// `provider`. Quatre cas :
///
///   1. Non authentifié           → LoginScreen
///   2. Authentifié, pas de PIN   → PinSetupScreen (création du code)
///   3. Authentifié + PIN, verrouillé → PinLockScreen (saisie du code)
///   4. Authentifié + PIN + déverrouillé → HomeScreen
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final tokenStore = context.watch<TokenStore>();
    final lockService = context.watch<LockService>();

    // Cas 1 : pas de token → écran de login.
    if (!tokenStore.isAuthenticated) {
      return const LoginScreen();
    }

    // Cas 2 : authentifié mais aucun PIN configuré → création du PIN.
    if (!lockService.pinSet) {
      return const PinSetupScreen();
    }

    // Cas 3 : PIN configuré mais app verrouillée → écran de déverrouillage.
    if (!lockService.unlocked) {
      return const PinLockScreen();
    }

    // Cas 4 : tout est OK → écran d'accueil.
    return const HomeScreen();
  }
}
