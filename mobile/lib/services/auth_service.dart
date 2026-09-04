import 'package:flutter/foundation.dart';
import 'package:graphql_flutter/graphql_flutter.dart';

import '../graphql/auth_operations.dart';
import '../models/app_user.dart';
import '../utils/token_store.dart';

/// Service d'authentification côté enfant.
///
/// Implémente `login` via la mutation GraphQL `login` du backend.
/// Le JWT retourné est stocké dans [TokenStore], ce qui déclenche le
/// rafraîchissement de l'UI (via provider) et rend le token disponible
/// pour les requêtes authentifiées suivantes (le client GraphQL le lit
/// via `tokenProvider`).
class AuthService extends ChangeNotifier {
  AuthService(this._tokenStore, this._client);

  final TokenStore _tokenStore;
  final GraphQLClient _client;

  TokenStore get tokenStore => _tokenStore;

  /// Authentifie l'utilisateur via la mutation `login`.
  ///
  /// En cas de succès, stocke le JWT + l'utilisateur dans [TokenStore]
  /// et retourne l'utilisateur. En cas d'erreur (identifiants invalides,
  /// réseau), lève une [GraphqlException] avec un message lisible.
  Future<AppUser> login({
    required String email,
    required String password,
  }) async {
    final result = await _client.mutate(
      MutationOptions(
        document: kLoginMutation,
        variables: {
          'email': email,
          'password': password,
        },
      ),
    );

    if (result.hasException) {
      throw GraphqlException(
        result.exception.toString(),
      );
    }

    final data = result.data?['login'] as Map<String, dynamic>?;
    if (data == null) {
      throw GraphqlException('Réponse vide du serveur');
    }

    final token = data['token'] as String;
    final user = AppUser.fromJson(data['user'] as Map<String, dynamic>);

    _tokenStore.setSession(token, user);
    return user;
  }

  /// Déconnexion : efface le token et l'utilisateur.
  void logout() {
    _tokenStore.clear();
  }
}

/// Exception pour les erreurs GraphQL remontées à l'UI.
class GraphqlException implements Exception {
  GraphqlException(this.message);
  final String message;

  @override
  String toString() => message;
}
