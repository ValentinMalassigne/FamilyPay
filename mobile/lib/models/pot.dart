/// Modèle de cagnotte côté mobile (projection du type GraphQL `Pot`).
///
/// Champs : id, title, targetAmount, currentAmount, publicToken,
/// withdrawalPolicy, status.
///
/// - `withdrawalPolicy` : "ANYTIME" | "WHEN_FULL" | "PARENT_ONLY".
/// - `status` : "OPEN" | "CLOSED".
class Pot {
  Pot({
    required this.id,
    required this.title,
    required this.targetAmount,
    required this.currentAmount,
    required this.publicToken,
    required this.withdrawalPolicy,
    required this.status,
  });

  final String id;
  final String title;
  final double targetAmount;
  final double currentAmount;
  final String publicToken;
  final String withdrawalPolicy;
  final String status;

  /// Progression de la cagnotte (0.0 à 1.0+).
  double get progress =>
      targetAmount > 0 ? currentAmount / targetAmount : 0;

  /// True si la cagnotte est clôturée.
  bool get isClosed => status == 'CLOSED';

  /// True si l'enfant peut retirer librement (policy ANYTIME).
  bool get canWithdrawAnytime => withdrawalPolicy == 'ANYTIME';

  /// True si le retrait nécessite que la cagnotte soit pleine (WHEN_FULL).
  bool get requiresFull => withdrawalPolicy == 'WHEN_FULL';

  /// True si seul un parent peut retirer (PARENT_ONLY).
  bool get parentOnly => withdrawalPolicy == 'PARENT_ONLY';

  /// True si la cagnotte a atteint son objectif.
  bool get isFull => currentAmount >= targetAmount;

  /// Construit un [Pot] depuis le JSON retourné par la query `pots`.
  factory Pot.fromJson(Map<String, dynamic> json) {
    return Pot(
      id: json['id'] as String,
      title: json['title'] as String,
      targetAmount: (json['targetAmount'] as num).toDouble(),
      currentAmount: (json['currentAmount'] as num).toDouble(),
      publicToken: json['publicToken'] as String,
      withdrawalPolicy: json['withdrawalPolicy'] as String,
      status: json['status'] as String,
    );
  }
}
