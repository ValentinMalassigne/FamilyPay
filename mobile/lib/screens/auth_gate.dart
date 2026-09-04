import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../utils/token_store.dart';
import 'home_screen.dart';
import 'login_screen.dart';

/// Routeur d'authentification : affiche l'écran de login ou l'écran d'accueil
/// selon l'état du [TokenStore].
///
/// Écoute [TokenStore] via `provider` : quand le token change (login/logout),
/// le widget se reconstruit automatiquement et bascule d'écran.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final tokenStore = context.watch<TokenStore>();

    if (tokenStore.isAuthenticated) {
      return const HomeScreen();
    }
    return const LoginScreen();
  }
}
