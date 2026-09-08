/// Modèle de mission côté mobile (projection du type GraphQL `Mission`).
///
/// Champs : id, title, reward, status.
///
/// - `status` : "PENDING" | "DONE_BY_CHILD" | "VALIDATED" | "REJECTED".
class Mission {
  Mission({
    required this.id,
    required this.title,
    required this.reward,
    required this.status,
  });

  final String id;
  final String title;
  final double reward;
  final String status;

  bool get isPending => status == 'PENDING';
  bool get isDoneByChild => status == 'DONE_BY_CHILD';
  bool get isValidated => status == 'VALIDATED';
  bool get isRejected => status == 'REJECTED';

  /// Construit une [Mission] depuis le JSON retourné par la query `missions`
  /// ou la mutation `markMissionDone`.
  factory Mission.fromJson(Map<String, dynamic> json) {
    return Mission(
      id: json['id'] as String,
      title: json['title'] as String,
      reward: (json['reward'] as num).toDouble(),
      status: json['status'] as String,
    );
  }
}
