import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../models/app_user.dart';

/// Wrapper autour de [FlutterSecureStorage] pour persister la session,
/// le code PIN et le flag biométrique.
///
/// Sur iOS, les données sont stockées dans le Keychain (chiffré par le Secure
/// Enclave). Sur Android, [FlutterSecureStorage] utilise
/// `EncryptedSharedPreferences` (AES-256). Dans les deux cas, le contenu est
/// chiffré au repos par la plateforme.
///
/// Le JWT et le profil utilisateur permettent de restaurer la session au
/// démarrage de l'app sans redemander un login. Le code PIN est stocké sous
/// forme de hash SHA-256 (jamais en clair), et le flag biométrique indique
/// si l'utilisateur a activé le déverrouillage par empreinte/Face ID.
class SecureStorageService {
  SecureStorageService({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  // Clés utilisées dans le stockage chiffré.
  static const _keyJwt = 'jwt';
  static const _keyUserJson = 'user_json';
  static const _keyPinHash = 'pin_hash';
  static const _keyBiometricEnabled = 'biometric_enabled';

  // ---- Session (JWT + utilisateur) ----

  /// Persiste le JWT et le profil utilisateur (sérialisé en JSON).
  /// Appelé par `TokenStore.setSession` après un login réussi.
  Future<void> saveSession(String token, AppUser user) async {
    await _storage.write(key: _keyJwt, value: token);
    await _storage.write(key: _keyUserJson, value: jsonEncode(user.toJson()));
  }

  /// Charge le JWT et l'utilisateur depuis le stockage chiffré.
  /// Retourne `null` pour chacun si rien n'est stocké (premier lancement
  /// ou après déconnexion).
  Future<({String? token, AppUser? user})> loadSession() async {
    final token = await _storage.read(key: _keyJwt);
    final userJson = await _storage.read(key: _keyUserJson);

    AppUser? user;
    if (userJson != null) {
      user = AppUser.fromJson(jsonDecode(userJson) as Map<String, dynamic>);
    }

    return (token: token, user: user);
  }

  /// Efface le JWT et l'utilisateur du stockage chiffré.
  /// Appelé par `TokenStore.clear` lors de la déconnexion.
  Future<void> clearSession() async {
    await _storage.delete(key: _keyJwt);
    await _storage.delete(key: _keyUserJson);
  }

  // ---- Code PIN ----

  /// Stocke le hash SHA-256 du code PIN. Le PIN n'est jamais stocké en clair,
  /// même dans le stockage chiffré.
  Future<void> savePin(String pinHash) async {
    await _storage.write(key: _keyPinHash, value: pinHash);
  }

  /// Récupère le hash du PIN stocké, ou `null` si aucun PIN n'est défini.
  Future<String?> loadPinHash() async {
    return _storage.read(key: _keyPinHash);
  }

  /// Indique si un code PIN a été configuré.
  Future<bool> hasPin() async {
    final hash = await _storage.read(key: _keyPinHash);
    return hash != null;
  }

  /// Efface le code PIN du stockage.
  Future<void> clearPin() async {
    await _storage.delete(key: _keyPinHash);
  }

  // ---- Flag biométrique ----

  /// Active ou désactive le flag "biométrie activée".
  Future<void> setBiometricEnabled(bool enabled) async {
    await _storage.write(
      key: _keyBiometricEnabled,
      value: enabled.toString(),
    );
  }

  /// Indique si l'utilisateur a activé le déverrouillage biométrique.
  Future<bool> isBiometricEnabled() async {
    final value = await _storage.read(key: _keyBiometricEnabled);
    return value == 'true';
  }
}
