import 'package:flutter/material.dart';
import 'package:graphql_flutter/graphql_flutter.dart';

import '../../graphql/child_operations.dart';

/// Écran plein d'ajout d'une dépense manuelle.
///
/// Formulaire : montant (positif), label, catégorie (optionnel).
/// Appelle la mutation `addManualExpense`. Le backend convertit le montant
/// en négatif et vérifie que le solde reste positif.
///
/// Sur succès : retourne `true` (l'appelant affiche un SnackBar et la
/// subscription `transactionAdded` rafraîchit la liste).
/// Sur erreur (ex: solde insuffisant) : SnackBar avec le message backend.
class AddExpenseScreen extends StatefulWidget {
  const AddExpenseScreen({super.key, required this.childId});

  final String childId;

  @override
  State<AddExpenseScreen> createState() => _AddExpenseScreenState();
}

class _AddExpenseScreenState extends State<AddExpenseScreen> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  final _labelController = TextEditingController();
  final _categoryController = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _amountController.dispose();
    _labelController.dispose();
    _categoryController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _loading = true);

    final client = GraphQLProvider.of(context).value;
    try {
      final result = await client.mutate(MutationOptions(
        document: kAddManualExpenseMutation,
        variables: {
          'childId': widget.childId,
          'amount': double.parse(_amountController.text.trim()),
          'label': _labelController.text.trim(),
          'category': _categoryController.text.trim().isEmpty
              ? null
              : _categoryController.text.trim(),
        },
      ));

      if (result.hasException) {
        final errors = result.exception?.graphqlErrors;
        final msg = (errors != null && errors.isNotEmpty)
            ? errors.first.message
            : 'Erreur inconnue';
        if (mounted) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(msg)));
        }
      } else {
        // Succès : la subscription transactionAdded rafraîchit la liste,
        // la subscription balanceUpdated rafraîchit le solde.
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Dépense ajoutée')),
          );
          Navigator.of(context).pop(true);
        }
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Nouvelle dépense')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              TextFormField(
                controller: _amountController,
                decoration: const InputDecoration(
                  labelText: 'Montant (€)',
                  border: OutlineInputBorder(),
                  prefixText: '€ ',
                ),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Montant requis';
                  }
                  final amount = double.tryParse(value.trim());
                  if (amount == null || amount <= 0) {
                    return 'Montant invalide (doit être positif)';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _labelController,
                decoration: const InputDecoration(
                  labelText: 'Libellé',
                  hintText: 'Ex: Snack, jeux, transport...',
                  border: OutlineInputBorder(),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Libellé requis';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _categoryController,
                decoration: const InputDecoration(
                  labelText: 'Catégorie (optionnel)',
                  hintText: 'Ex: Fast-food, Loisirs',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _loading ? null : _submit,
                  child: _loading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Ajouter'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
