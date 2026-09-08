/// Modèle de transaction côté mobile (projection du type GraphQL `Transaction`).
///
/// Champs : id, childId, amount, type, label?, category?, createdAt, createdBy.
///
/// - `amount` : positif = crédit, négatif = débit.
/// - `type` : String simple ("RECHARGE", "EXPENSE", "ALLOWANCE"...).
/// - `createdBy` : String simple ("SYSTEM", "CHILD", "PARENT").
/// - `label` et `category` sont optionnels (nullables).
class Transaction {
  Transaction({
    required this.id,
    required this.childId,
    required this.amount,
    required this.type,
    required this.createdAt,
    required this.createdBy,
    this.label,
    this.category,
  });

  final String id;
  final String childId;
  final double amount;
  final String type;
  final String? label;
  final String? category;
  final String createdAt;
  final String createdBy;

  /// True si la transaction est un crédit (montant positif).
  bool get isCredit => amount >= 0;

  /// Construit une [Transaction] depuis le JSON retourné par la query
  /// `transactions` ou la subscription `transactionAdded`.
  factory Transaction.fromJson(Map<String, dynamic> json) {
    return Transaction(
      id: json['id'] as String,
      childId: json['childId'] as String,
      amount: (json['amount'] as num).toDouble(),
      type: json['type'] as String,
      label: json['label'] as String?,
      category: json['category'] as String?,
      createdAt: json['createdAt'] as String,
      createdBy: json['createdBy'] as String,
    );
  }
}
