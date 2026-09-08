import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';

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
  LockService(this._storage);

  final SecureStorageService _storage;

  /// Un code PIN a-t-il été configuré ? (persisté)
  bool _pinSet = false;
  bool get pinSet => _pinSet;

  /// L'app est-elle actuellement déverrouillée ? (en mémoire, reset au reboot)
  bool _unlocked = false;
  bool get unlocked => _unlocked;

  /// La biométrie est-elle activée ? (persisté)
  bool _biometricEnabled = false;
  bool get biometricEnabled => _biometricEnabled;

  /// Le device supporte-t-il l'auth biométrique ? Renseigné par le commit 3.
  bool _biometricAvailable = false;
  bool get biometricAvailable => _biometricAvailable;

  /// Charge l'état initial depuis le secure storage au démarrage de l'app.
  /// Appelé une fois dans `main()`.
  Future<void> init() async {
    _pinSet = await _storage.hasPin();
    _biometricEnabled = await _storage.isBiometricEnabled();
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

  /// Renseigne si le device supporte la biométrie (appelé depuis le commit 3
  /// après vérification via local_auth).
  void setBiometricAvailable(bool available) {
    _biometricAvailable = available;
    notifyListeners();
  }

  /// Tente l'authentification biométrique. Implémenté dans le commit 3.
  /// Retourne true si l'auth réussit et déverrouille l'app.
  Future<bool> authenticateWithBiometrics() async {
    // Implémenté dans le commit 3 (local_auth).
    return false;
  }
}
