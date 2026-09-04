import 'package:flutter/foundation.dart';

import '../utils/token_store.dart';

/// Service d'authentification côté enfant.
///
/// Stub pour l'initialisation : l'implémentation réelle (appel de la
/// mutation `login` GraphQL, parsing du `AuthPayload`, stockage du JWT)
/// viendra sur la branche feat/mobile-auth.
///
/// Ici on ne fait que câbler le [TokenStore] pour que le reste de l'app
/// puisse déjà référencer un token (toujours null pour l'instant).
class AuthService extends ChangeNotifier {
  AuthService(this._tokenStore);

  final TokenStore _tokenStore;

  TokenStore get tokenStore => _tokenStore;

  // TODO(feat/mobile-auth): implémenter login(email, password) via mutation GraphQL.
  // TODO(feat/mobile-auth): implémenter logout().
}
