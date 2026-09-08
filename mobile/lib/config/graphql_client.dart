import 'package:flutter/material.dart';
import 'package:gql/ast.dart' show OperationType;
import 'package:graphql_flutter/graphql_flutter.dart';

import '../screens/auth_gate.dart';

/// Fabrique un [ValueNotifier<GraphQLClient>] configuré pour le backend
/// FamilyPay.
///
/// Le client combine trois links (les "links" forment une chaîne de
/// middlewares appliquée à chaque requête GraphQL) :
///   1. [AuthLink]  : injecte le header `Authorization: Bearer <jwt>` si un
///      token est disponible (récupéré via [tokenProvider]).
///   2. [HttpLink]  : exécute les queries/mutations en HTTP vers [graphqlUrl].
///   3. [WebSocketLink] : achemine les subscriptions vers le backend en
///      WebSocket (le temps réel — solde, transactions — passe par là).
///
/// [Link.split] route chaque requête : si c'est une subscription, on utilise
/// le WebSocketLink ; sinon la chaîne AuthLink + HttpLink.
ValueNotifier<GraphQLClient> initGraphqlClient({
  required String graphqlUrl,
  required Future<String?> Function() tokenProvider,
}) {
  final httpLink = HttpLink(graphqlUrl);

  final authLink = AuthLink(
    // AuthLink appelle getToken() à chaque requête ; on lui passe une
    // fonction qui récupère le JWT courant (stocké ailleurs).
    // Pas de token => null : AuthLink n'ajoute alors pas le header
    // Authorization (utile pour login et la mutation publique de don).
    getToken: () async {
      final token = await tokenProvider();
      return token == null ? null : 'Bearer $token';
    },
  );

  // L'URL WebSocket se déduit de l'URL HTTP : http(s):// -> ws(s)://.
  final wsUrl = graphqlUrl.replaceFirst('http', 'ws');

  // WebSocketLink pour les subscriptions GraphQL.
  //
  // subProtocol : le backend NestJS configure `subscriptions: { 'graphql-ws': true }`
  // qui utilise le package npm `graphql-ws`. Ce package implémente le protocole
  // `graphql-transport-ws` (le standard moderne), PAS l'ancien protocole
  // `graphql-ws` (déprécié). Sans ce subProtocol explicite, le client utilise
  // `graphql-ws` par défaut, le serveur refuse la connexion (inadéquation de
  // protocole) et le client boucle en reconnexion infinie.
  //
  // initialPayload : le JWT est passé via `connectionParams` du protocole
  // `graphql-transport-ws`. Le `connection_init` envoyé à la connexion
  // contient ce payload, que le backend lit dans le contexte GraphQL pour
  // authentifier la subscription (le GqlAuthGuard lit `connectionParams`
  // quand `ctx.req` n'est pas une requête HTTP Express).
  final wsLink = WebSocketLink(
    wsUrl,
    config: SocketClientConfig(
      initialPayload: () async {
        final token = await tokenProvider();
        return token == null ? {} : {'authorization': 'Bearer $token'};
      },
    ),
    subProtocol: GraphQLProtocol.graphqlTransportWs,
  );

  final link = Link.split(
    // Route les subscriptions vers le WebSocket, le reste vers HTTP.
    (Request request) => request.operation.getOperationType() == OperationType.subscription,
    wsLink,
    authLink.concat(httpLink),
  );

  return ValueNotifier<GraphQLClient>(
    GraphQLClient(
      link: link,
      // GraphQLCache : cache en mémoire des résultats de queries.
      // defaultPolicies désactivé ici pour rester simple en dev.
      cache: GraphQLCache(),
    ),
  );
}

/// Widget racine de l'app FamilyPay.
///
/// [GraphQLProvider] expose le client GraphQL à toute la sous-arborescence
/// via InheritedWidget, pour que les widgets Query/Mutation/Subscription
/// puissent l'utiliser sans le passer manuellement.
/// [AuthGate] gère le routage login vs home selon l'état d'authentification.
class FamilyPayApp extends StatelessWidget {
  const FamilyPayApp({super.key, required this.client});

  final ValueNotifier<GraphQLClient> client;

  @override
  Widget build(BuildContext context) {
    return GraphQLProvider(
      client: client,
      child: MaterialApp(
        title: 'FamilyPay',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: Colors.indigo),
          useMaterial3: true,
        ),
        home: const AuthGate(),
      ),
    );
  }
}
