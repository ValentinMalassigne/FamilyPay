import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:graphql_flutter/graphql_flutter.dart';
import 'package:provider/provider.dart';

import 'package:familypay/config/graphql_client.dart';
import 'package:familypay/models/app_user.dart';
import 'package:familypay/services/auth_service.dart';
import 'package:familypay/services/secure_storage_service.dart';
import 'package:familypay/utils/token_store.dart';

// Test du flux d'authentification : vérifie que l'app affiche l'écran de
// login tant que l'utilisateur n'est pas connecté. Aucun appel réseau —
// le client GraphQL pointe vers une URL factice (on ne soumet pas le form).

GraphQLClient _fakeClient() => GraphQLClient(
      link: HttpLink('http://localhost:3000/graphql'),
      cache: GraphQLCache(),
    );

// Mock du method channel de flutter_secure_storage : on stocke les paires
// clé/valeur dans une Map en mémoire pour simuler le stockage chiffré.
const _channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
final Map<String, String> _mockStore = {};

void _setupSecureStorageMock() {
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(_channel, (MethodCall call) async {
    final args = call.arguments as Map;
    final key = args['key'] as String?;
    switch (call.method) {
      case 'write':
        _mockStore[key!] = args['value'] as String;
        return null;
      case 'read':
        return _mockStore[key];
      case 'delete':
        _mockStore.remove(key);
        return null;
      case 'deleteAll':
        _mockStore.clear();
        return null;
      case 'containsKey':
        return _mockStore.containsKey(key);
      case 'readAll':
        return _mockStore;
      default:
        return null;
    }
  });
}

void main() {
  setUp(() {
    _mockStore.clear();
    _setupSecureStorageMock();
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(_channel, null);
  });

  testWidgets('affiche l\'écran de login quand non authentifié',
      (WidgetTester tester) async {
    final storage = SecureStorageService();
    final tokenStore = TokenStore();
    final client = ValueNotifier<GraphQLClient>(_fakeClient());
    final authService = AuthService(tokenStore, storage, client.value);

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<TokenStore>.value(value: tokenStore),
          ChangeNotifierProvider<AuthService>.value(value: authService),
          Provider<SecureStorageService>.value(value: storage),
        ],
        child: FamilyPayApp(client: client),
      ),
    );

    // L'écran de login est affiché (non authentifié).
    expect(find.text('Connexion'), findsOneWidget);
    expect(find.byType(TextFormField), findsNWidgets(2));
    expect(find.text('Se connecter'), findsOneWidget);
  });

  testWidgets('affiche l\'écran d\'accueil quand authentifié',
      (WidgetTester tester) async {
    final storage = SecureStorageService();
    final tokenStore = TokenStore();
    // Simule un utilisateur connecté.
    await tokenStore.setSession(
      'fake-jwt',
      AppUser(
        id: '1',
        email: 'enfant@test.com',
        role: 'CHILD',
        firstName: 'Alice',
        lastName: 'Doe',
      ),
      storage,
    );
    final client = ValueNotifier<GraphQLClient>(_fakeClient());
    final authService = AuthService(tokenStore, storage, client.value);

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<TokenStore>.value(value: tokenStore),
          ChangeNotifierProvider<AuthService>.value(value: authService),
          Provider<SecureStorageService>.value(value: storage),
        ],
        child: FamilyPayApp(client: client),
      ),
    );

    // L'écran d'accueil est affiché (authentifié).
    expect(find.text('FamilyPay'), findsOneWidget);
    expect(find.byIcon(Icons.logout), findsOneWidget);
  });
}
