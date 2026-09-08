/// Modèle du compte enfant côté mobile (projection du type GraphQL `ChildAccount`).
///
/// On ne garde que les champs utiles à l'app enfant :
/// id, userId, balance, blocked, blockedBy.
///
/// `blockedBy` est nullable : "PARENT" (carte bloquée par un parent — seul un
/// parent peut débloquer), "CHILD" (l'enfant s'est bloqué lui-même), ou null
/// (carte non bloquée). On garde une String simple plutôt qu'un enum.
class ChildAccount {
  ChildAccount({
    required this.id,
    required this.userId,
    required this.balance,
    required this.blocked,
    this.blockedBy,
  });

  final String id;
  final String userId;
  final double balance;
  final bool blocked;
  final String? blockedBy;

  /// Construit un [ChildAccount] depuis le JSON retourné par la query
  /// `myChildAccount` ou la subscription `balanceUpdated`.
  factory ChildAccount.fromJson(Map<String, dynamic> json) {
    return ChildAccount(
      id: json['id'] as String,
      userId: json['userId'] as String,
      balance: (json['balance'] as num).toDouble(),
      blocked: json['blocked'] as bool,
      blockedBy: json['blockedBy'] as String?,
    );
  }
}
