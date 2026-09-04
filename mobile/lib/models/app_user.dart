/// Modèle utilisateur côté mobile (projection du type GraphQL `User`).
///
/// On ne garde que les champs utiles à l'app enfant : id, email, role,
/// firstName, lastName. Le `role` est une String simple (les valeurs
/// possibles sont "PARENT" | "CHILD") — on évite un enum tant qu'on n'a
/// pas de logique de branchement dessus.
class AppUser {
  AppUser({
    required this.id,
    required this.email,
    required this.role,
    required this.firstName,
    required this.lastName,
  });

  final String id;
  final String email;
  final String role;
  final String firstName;
  final String lastName;

  /// Construit un [AppUser] depuis la réponse JSON de la mutation `login`
  /// (champ `user` du `AuthPayload`).
  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['id'] as String,
      email: json['email'] as String,
      role: json['role'] as String,
      firstName: json['firstName'] as String,
      lastName: json['lastName'] as String,
    );
  }
}
