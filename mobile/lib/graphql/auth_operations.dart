import 'package:graphql_flutter/graphql_flutter.dart';

/// Documents GraphQL pour l'authentification.
///
/// `gql()` parse une chaîne GraphQL en `DocumentNode`, le format attendu
/// par `MutationOptions(document: ...)` / `QueryOptions(document: ...)`.

/// Mutation `login` : authentifie un utilisateur (parent ou enfant).
/// Retourne un `AuthPayload` contenant le JWT (`token`) et l'utilisateur.
final kLoginMutation = gql(r'''
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user {
        id
        email
        role
        firstName
        lastName
      }
    }
  }
''');

/// Query `me` : retourne l'utilisateur courant (authentifié via JWT).
/// Sert à vérifier que le token est valide et récupérer le profil.
final kMeQuery = gql(r'''
  query Me {
    me {
      id
      email
      role
      firstName
      lastName
    }
  }
''');
