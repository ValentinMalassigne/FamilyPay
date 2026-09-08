import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:graphql_flutter/graphql_flutter.dart';
import 'package:provider/provider.dart';

import 'package:familypay/config/graphql_client.dart';
import 'package:familypay/models/app_user.dart';
import 'package:familypay/services/auth_service.dart';
import 'package:familypay/services/lock_service.dart';
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

// Construit un utilisateur factice pour les tests.
final _fakeUser = AppUser(
  id: '1',
  email: 'enfant@test.com',
  role: 'CHILD',
  firstName: 'Alice',
  lastName: 'Doe',
);

// Construit le widget racine avec tous les providers nécessaires.
Widget _testApp(
  TokenStore tokenStore,
  AuthService authService,
  SecureStorageService storage,
  LockService lockService,
  ValueNotifier<GraphQLClient> client,
) {
  return MultiProvider(
    providers: [
      ChangeNotifierProvider<TokenStore>.value(value: tokenStore),
      ChangeNotifierProvider<AuthService>.value(value: authService),
      Provider<SecureStorageService>.value(value: storage),
      ChangeNotifierProvider<LockService>.value(value: lockService),
    ],
    child: FamilyPayApp(client: client),
  );
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
    final lockService = LockService(storage);
    await lockService.init();
    final client = ValueNotifier<GraphQLClient>(_fakeClient());
    final authService = AuthService(tokenStore, storage, client.value);

    await tester.pumpWidget(
      _testApp(tokenStore, authService, storage, lockService, client),
    );

    // L'écran de login est affiché (non authentifié).
    expect(find.text('Connexion'), findsOneWidget);
    expect(find.byType(TextFormField), findsNWidgets(2));
    expect(find.text('Se connecter'), findsOneWidget);
  });

  testWidgets('affiche l\'écran de création de PIN quand authentifié sans PIN',
      (WidgetTester tester) async {
    final storage = SecureStorageService();
    final tokenStore = TokenStore();
    await tokenStore.setSession('fake-jwt', _fakeUser, storage);
    final lockService = LockService(storage);
    await lockService.init(); // pinSet = false
    final client = ValueNotifier<GraphQLClient>(_fakeClient());
    final authService = AuthService(tokenStore, storage, client.value);

    await tester.pumpWidget(
      _testApp(tokenStore, authService, storage, lockService, client),
    );

    // Authentifié mais pas de PIN → PinSetupScreen.
    expect(find.text('Crée ton code PIN'), findsOneWidget);
  });

  testWidgets('affiche l\'écran d\'accueil quand authentifié et déverrouillé',
      (WidgetTester tester) async {
    final storage = SecureStorageService();
    final tokenStore = TokenStore();
    await tokenStore.setSession('fake-jwt', _fakeUser, storage);
    final lockService = LockService(storage);
    // setPin persiste le hash et déverrouille (pinSet=true, unlocked=true).
    await lockService.setPin('1234');
    final client = ValueNotifier<GraphQLClient>(_fakeClient());
    final authService = AuthService(tokenStore, storage, client.value);

    await tester.pumpWidget(
      _testApp(tokenStore, authService, storage, lockService, client),
    );

    // Authentifié + PIN + déverrouillé → HomeScreen.
    expect(find.text('FamilyPay'), findsOneWidget);
    expect(find.byIcon(Icons.logout), findsOneWidget);
  });
}
