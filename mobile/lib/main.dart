import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:provider/provider.dart';

import 'config/graphql_client.dart';
import 'services/auth_service.dart';
import 'utils/token_store.dart';

/// Point d'entrée de l'app mobile FamilyPay (côté enfant).
///
/// Étapes :
///   1. Chargement du fichier `.env` (variables de build, jamais hardcodées).
///   2. Construction du client GraphQL (HTTP + WebSocket pour le temps réel).
///   3. Fourniture des services via `provider` (TokenStore, AuthService).
Future<void> main() async {
  // flutter_dotenv nécessite l'initialisation des bindings Flutter avant
  // de pouvoir charger un asset (le fichier .env est déclaré en asset).
  WidgetsFlutterBinding.ensureInitialized();

  await dotenv.load(fileName: '.env');

  // TokenStore partagé : détient le JWT de l'enfant connecté.
  // Le client GraphQL le lit via `tokenProvider` à chaque requête.
  final tokenStore = TokenStore();
  final authService = AuthService(tokenStore);

  final graphqlUrl = dotenv.get('GRAPHQL_URL');

  final client = initGraphqlClient(
    graphqlUrl: graphqlUrl,
    tokenProvider: () async => tokenStore.token,
  );

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<TokenStore>.value(value: tokenStore),
        ChangeNotifierProvider<AuthService>.value(value: authService),
      ],
      child: FamilyPayApp(client: client),
    ),
  );
}
