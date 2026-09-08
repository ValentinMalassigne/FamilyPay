import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';

import 'secure_storage_service.dart';

/// Gère l'état du verrouillage de l'app par code PIN.
///
/// Trois états暴露s via [ChangeNotifier] pour que l'AuthGate puisse réagir :
/// - [pinSet] : un code PIN a été configuré (persisté dans le secure storage).
/// - [unlocked] : l'app est actuellement déverrouillée (en mémoire uniquement,
///   remis à false à chaque redémarrage).
///
/// Le PIN est stocké sous forme de hash SHA-256 dans le secure storage —
/// jamais en clair. Pour un projet MVP d'apprentissage c'est suffisant ; un
/// app de production utiliserait un hash salé lent (bcrypt/argon2) avec
/// rate-limiting.
///
/// Le flag biométrique (activer/désactiver Face ID / empreinte) est géré ici
/// aussi pour centraliser l'état de verrouillage. Les méthodes biométriques
/// sont ajoutées dans le commit 3.
class LockService extends ChangeNotifier {
  LockService(this._storage, {LocalAuthentication? localAuth})
      : _localAuth = localAuth ?? LocalAuthentication();

  final SecureStorageService _storage;

  // Plugin local_auth : accède à Touch ID / Face ID (iOS) et empreinte /
  // visage (Android). Injecté en paramètre pour permettre les tests.
  final LocalAuthentication _localAuth;

  /// Un code PIN a-t-il été configuré ? (persisté)
  bool _pinSet = false;
  bool get pinSet => _pinSet;

  /// L'app est-elle actuellement déverrouillée ? (en mémoire, reset au reboot)
  bool _unlocked = false;
  bool get unlocked => _unlocked;

  /// La biométrie est-elle activée ? (persisté)
  bool _biometricEnabled = false;
  bool get biometricEnabled => _biometricEnabled;

  /// Le device supporte-t-il l'auth biométrique ? Renseigné dans init().
  bool _biometricAvailable = false;
  bool get biometricAvailable => _biometricAvailable;

  /// Charge l'état initial depuis le secure storage au démarrage de l'app.
  /// Appelé une fois dans `main()`.
  Future<void> init() async {
    _pinSet = await _storage.hasPin();
    _biometricEnabled = await _storage.isBiometricEnabled();
    // Vérifie si le device supporte la biométrie (Touch ID / Face ID /
    // empreinte). Si non, l'opt-in biométrique ne sera pas proposé.
    _biometricAvailable = await _localAuth.canCheckBiometrics;
    // Au démarrage, l'app n'est jamais déverrouillée si un PIN est défini.
    _unlocked = !_pinSet;
    notifyListeners();
  }

  /// Verrouille l'app (remet `_unlocked` à false).
  /// Appelé quand l'app passe en arrière-plan (HomeScreen lifecycle observer).
  void lock() {
    if (!_pinSet) return;
    _unlocked = false;
    notifyListeners();
  }

  /// Déverrouille l'app.
  void _unlock() {
    _unlocked = true;
    notifyListeners();
  }

  /// Hash un PIN en SHA-256 (encodé en hex).
  static String _hashPin(String pin) {
    return sha256.convert(pin.codeUnits).toString();
  }

  /// Vérifie un code PIN saisi par l'utilisateur.
  /// Retourne true si le PIN correspond, déverrouille l'app et notifie.
  Future<bool> verifyPin(String pin) async {
    final storedHash = await _storage.loadPinHash();
    if (storedHash == null) return false;
    final match = _hashPin(pin) == storedHash;
    if (match) {
      _unlock();
    }
    return match;
  }

  /// Configure un nouveau code PIN (première fois ou changement).
  /// Hashe le PIN et le persiste dans le secure storage, puis déverrouille.
  Future<void> setPin(String pin) async {
    await _storage.savePin(_hashPin(pin));
    _pinSet = true;
    _unlocked = true;
    notifyListeners();
  }

  /// Change le code PIN après vérification de l'ancien.
  /// Retourne false si l'ancien PIN ne correspond pas.
  Future<bool> changePin(String oldPin, String newPin) async {
    final storedHash = await _storage.loadPinHash();
    if (storedHash == null) return false;
    if (_hashPin(oldPin) != storedHash) return false;
    await _storage.savePin(_hashPin(newPin));
    return true;
  }

  /// Efface le code PIN (utilisé à la déconnexion).
  Future<void> clearPin() async {
    await _storage.clearPin();
    _pinSet = false;
    _unlocked = false;
    _biometricEnabled = false;
    notifyListeners();
  }

  // ---- Biométrie (commit 3) ----

  /// Active le déverrouillage biométrique.
  Future<void> enableBiometric() async {
    await _storage.setBiometricEnabled(true);
    _biometricEnabled = true;
    notifyListeners();
  }

  /// Désactive le déverrouillage biométrique.
  Future<void> disableBiometric() async {
    await _storage.setBiometricEnabled(false);
    _biometricEnabled = false;
    notifyListeners();
  }

  /// Renseigne si le device supporte la biométrie (utile pour les tests).
  void setBiometricAvailable(bool available) {
    _biometricAvailable = available;
    notifyListeners();
  }

  /// Tente l'authentification biométrique (Touch ID / Face ID / empreinte).
  ///
  /// `biometricOnly: true` empêche le fallback vers le PIN/pattern du device :
  /// l'app a déjà son propre écran de PIN en fallback. Retourne true et
  /// déverrouille l'app si l'auth réussit.
  Future<bool> authenticateWithBiometrics() async {
    if (!_biometricAvailable) return false;
    try {
      final ok = await _localAuth.authenticate(
        localizedReason: 'Déverrouille FamilyPay',
        options: const AuthenticationOptions(biometricOnly: true),
      );
      if (ok) {
        _unlock();
      }
      return ok;
    } on PlatformException {
      // Échec biométrique (capteur indisponible, utilisateur annule…) :
      // l'utilisateur peut retomber sur la saisie manuelle du PIN.
      return false;
    }
  }
}
