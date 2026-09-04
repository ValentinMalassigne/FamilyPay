import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:graphql_flutter/graphql_flutter.dart';

import 'package:familypay/config/graphql_client.dart';

// Smoke test minimal : vérifie que FamilyPayApp se construit et affiche
// son écran placeholder. Aucun appel réseau (le placeholder n'émet pas de
// query). Les tests réels viendront avec les features (feat/mobile-*).
void main() {
  testWidgets('FamilyPayApp affiche le placeholder', (WidgetTester tester) async {
    final client = ValueNotifier<GraphQLClient>(
      GraphQLClient(
        link: HttpLink('http://localhost:3000/graphql'),
        cache: GraphQLCache(),
      ),
    );

    await tester.pumpWidget(FamilyPayApp(client: client));

    expect(find.text('FamilyPay'), findsOneWidget);
    expect(find.text('App initialisée — écrans à venir'), findsOneWidget);
  });
}
