/// Modèle du compte enfant côté mobile (projection du type GraphQL `ChildAccount`).
///
/// On ne garde que les champs utiles à l'app enfant :
/// id, userId, balance, blocked, blockedBy.
///
/// `blockedBy` est nullable : "PARENT" (carte bloquée par un parent — seul un
/// parent peut débloquer), "CHILD" (l'enfant s'est bloqué lui-même), ou null
/// (carte non bloquée). On garde une String simple plutôt qu'un enum.
///
/// `userId` est nullable car le backend n'expose pas `userId` comme champ
/// GraphQL direct (il expose `user { id }` à la place). L'app enfant connaît
/// déjà son propre user ID via [TokenStore.user.id], donc on n'en a pas besoin
/// ici. Les queries/mutations ne demandent pas `userId`.
class ChildAccount {
  ChildAccount({
    required this.id,
    required this.balance,
    required this.blocked,
    this.userId,
    this.blockedBy,
  });

  final String id;
  final String? userId;
  final double balance;
  final bool blocked;
  final String? blockedBy;

  /// Construit un [ChildAccount] depuis le JSON retourné par la query
  /// `myChildAccount`, la mutation `setCardBlocked` ou la subscription
  /// `balanceUpdated`. `userId` est optionnel (non exposé par le backend).
  factory ChildAccount.fromJson(Map<String, dynamic> json) {
    return ChildAccount(
      id: json['id'] as String,
      userId: json['userId'] as String?,
      balance: (json['balance'] as num).toDouble(),
      blocked: json['blocked'] as bool,
      blockedBy: json['blockedBy'] as String?,
    );
  }
}
