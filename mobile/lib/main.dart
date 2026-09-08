import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:provider/provider.dart';

import 'config/graphql_client.dart';
import 'services/auth_service.dart';
import 'services/lock_service.dart';
import 'services/secure_storage_service.dart';
import 'utils/token_store.dart';

/// Point d'entrée de l'app mobile FamilyPay (côté enfant).
///
/// Étapes :
///   1. Chargement du fichier `.env` (variables de build, jamais hardcodées).
///   2. Restauration de la session depuis le stockage chiffré (Keychain /
///      EncryptedSharedPreferences) — si un JWT y est stocké, l'utilisateur
///      est déjà connecté sans avoir à ressaisir ses identifiants.
///   3. Initialisation du LockService (charge l'état du PIN depuis le secure
///      storage) pour savoir si l'app doit afficher l'écran de verrouillage.
///   4. Construction du client GraphQL (HTTP + WebSocket pour le temps réel).
///   5. Fourniture des services via `provider` (TokenStore, AuthService,
///      SecureStorageService, LockService).
Future<void> main() async {
  // flutter_dotenv nécessite l'initialisation des bindings Flutter avant
  // de pouvoir charger un asset (le fichier .env est déclaré en asset).
  WidgetsFlutterBinding.ensureInitialized();

  await dotenv.load(fileName: '.env');

  // Service de stockage chiffré partagé par TokenStore, AuthService et
  // LockService pour persister JWT, profil, hash du PIN et flag biométrique.
  final secureStorage = SecureStorageService();

  // TokenStore partagé : détient le JWT de l'enfant connecté.
  // Le client GraphQL le lit via `tokenProvider` à chaque requête.
  final tokenStore = TokenStore();

  // Restaure la session (JWT + utilisateur) si elle existe au stockage.
  await tokenStore.loadFromStorage(secureStorage);

  // LockService : gère le verrouillage par code PIN. init() charge l'état
  // persisté (PIN défini ? biométrie activée ?) et détermine si l'app doit
  // être verrouillée au démarrage.
  final lockService = LockService(secureStorage);
  await lockService.init();

  final graphqlUrl = dotenv.get('GRAPHQL_URL');

  final client = initGraphqlClient(
    graphqlUrl: graphqlUrl,
    tokenProvider: () async => tokenStore.token,
  );

  // AuthService a besoin du client GraphQL pour appeler la mutation login
  // et du SecureStorageService pour persister la session.
  final authService = AuthService(tokenStore, secureStorage, client.value);

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<TokenStore>.value(value: tokenStore),
        ChangeNotifierProvider<AuthService>.value(value: authService),
        Provider<SecureStorageService>.value(value: secureStorage),
        ChangeNotifierProvider<LockService>.value(value: lockService),
      ],
      child: FamilyPayApp(client: client),
    ),
  );
}
