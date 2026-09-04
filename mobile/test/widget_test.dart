import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:graphql_flutter/graphql_flutter.dart';
import 'package:provider/provider.dart';

import 'package:familypay/config/graphql_client.dart';
import 'package:familypay/models/app_user.dart';
import 'package:familypay/services/auth_service.dart';
import 'package:familypay/utils/token_store.dart';

// Test du flux d'authentification : vérifie que l'app affiche l'écran de
// login tant que l'utilisateur n'est pas connecté. Aucun appel réseau —
// le client GraphQL pointe vers une URL factice (on ne soumet pas le form).

GraphQLClient _fakeClient() => GraphQLClient(
      link: HttpLink('http://localhost:3000/graphql'),
      cache: GraphQLCache(),
    );

void main() {
  testWidgets('affiche l\'écran de login quand non authentifié',
      (WidgetTester tester) async {
    final tokenStore = TokenStore();
    final client = ValueNotifier<GraphQLClient>(_fakeClient());
    final authService = AuthService(tokenStore, client.value);

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<TokenStore>.value(value: tokenStore),
          ChangeNotifierProvider<AuthService>.value(value: authService),
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
    final tokenStore = TokenStore();
    // Simule un utilisateur connecté.
    tokenStore.setSession(
      'fake-jwt',
      AppUser(
        id: '1',
        email: 'enfant@test.com',
        role: 'CHILD',
        firstName: 'Alice',
        lastName: 'Doe',
      ),
    );
    final client = ValueNotifier<GraphQLClient>(_fakeClient());
    final authService = AuthService(tokenStore, client.value);

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<TokenStore>.value(value: tokenStore),
          ChangeNotifierProvider<AuthService>.value(value: authService),
        ],
        child: FamilyPayApp(client: client),
      ),
    );

    // L'écran d'accueil est affiché (authentifié).
    expect(find.text('Bienvenue Alice'), findsOneWidget);
    expect(find.byIcon(Icons.logout), findsOneWidget);
  });
}
