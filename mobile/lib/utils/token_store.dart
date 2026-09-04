import 'package:flutter/foundation.dart';

import '../models/app_user.dart';

/// Stockage en mémoire du JWT et du profil de l'utilisateur connecté.
///
/// La persistance réelle (shared_preferences) viendra plus tard. En l'état,
/// le token est perdu à chaque redémarrage de l'app — c'est attendu pour
/// cette itération.
///
/// [ChangeNotifier] : permet au widget arbre (via `provider`) d'être notifié
/// quand l'état d'auth change, pour rafraîchir l'UI (login vs home).
class TokenStore extends ChangeNotifier {
  String? _token;
  AppUser? _user;

  String? get token => _token;
  AppUser? get user => _user;

  bool get isAuthenticated => _token != null;

  /// Stocke le JWT + l'utilisateur et notifie les listeners.
  void setSession(String token, AppUser user) {
    _token = token;
    _user = user;
    notifyListeners();
  }

  /// Efface le JWT et l'utilisateur (déconnexion).
  void clear() {
    _token = null;
    _user = null;
    notifyListeners();
  }
}
