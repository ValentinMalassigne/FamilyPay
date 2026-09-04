import 'package:flutter/foundation.dart';

/// Stockage en mémoire du JWT de l'enfant connecté.
///
/// Stub pour l'initialisation : la persistance réelle (shared_preferences)
/// viendra sur la branche feat/mobile-auth. En l'état, le token est perdu à
/// chaque redémarrage de l'app — c'est attendu pour ce squelette.
///
/// [ChangeNotifier] : permet au widget arbre (via `provider`) d'être notifié
/// quand le token change, pour rafraîchir le client GraphQL si besoin.
class TokenStore extends ChangeNotifier {
  String? _token;

  String? get token => _token;

  bool get isAuthenticated => _token != null;

  /// Stocke le JWT et notifie les listeners.
  void setToken(String? token) {
    _token = token;
    notifyListeners();
  }

  /// Efface le JWT (déconnexion).
  void clear() {
    _token = null;
    notifyListeners();
  }
}
