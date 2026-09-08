import 'package:flutter/foundation.dart';

import '../models/app_user.dart';
import '../services/secure_storage_service.dart';

/// Stockage en mémoire du JWT et du profil de l'utilisateur connecté.
///
/// La persistance est assurée par [SecureStorageService] (Keychain iOS /
/// EncryptedSharedPreferences Android) : le JWT et l'utilisateur sont restaurés
/// au démarrage de l'app via [loadFromStorage], de sorte que l'utilisateur
/// n'a pas à se reconnecter après un redémarrage à froid.
///
/// [ChangeNotifier] : permet au widget arbre (via `provider`) d'être notifié
/// quand l'état d'auth change, pour rafraîchir l'UI (login vs home).
class TokenStore extends ChangeNotifier {
  String? _token;
  AppUser? _user;

  String? get token => _token;
  AppUser? get user => _user;

  bool get isAuthenticated => _token != null;

  /// Restaure la session depuis le stockage chiffré au démarrage de l'app.
  /// Appelé une fois dans `main()` avant `runApp`.
  Future<void> loadFromStorage(SecureStorageService storage) async {
    final session = await storage.loadSession();
    if (session.token != null && session.user != null) {
      _token = session.token;
      _user = session.user;
      notifyListeners();
    }
  }

  /// Stocke le JWT + l'utilisateur en mémoire ET dans le stockage chiffré,
  /// puis notifie les listeners.
  Future<void> setSession(
    String token,
    AppUser user,
    SecureStorageService storage,
  ) async {
    _token = token;
    _user = user;
    await storage.saveSession(token, user);
    notifyListeners();
  }

  /// Efface le JWT et l'utilisateur de la mémoire ET du stockage chiffré
  /// (déconnexion).
  Future<void> clear(SecureStorageService storage) async {
    _token = null;
    _user = null;
    await storage.clearSession();
    notifyListeners();
  }
}
