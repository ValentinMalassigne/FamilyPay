import 'package:flutter/material.dart';
import 'package:graphql_flutter/graphql_flutter.dart';

import '../../graphql/child_operations.dart';
import '../../models/pot.dart';

/// Onglet Cagnottes : liste des cagnottes avec progression et retrait.
///
/// - `Query` `pots` → liste des cagnottes de l'enfant.
/// - Bouton "Retirer" par cagnotte (si OPEN et currentAmount > 0) :
///   - `PARENT_ONLY` → désactivé + message.
///   - `WHEN_FULL` et cagnotte non pleine → désactivé + message.
///   - Sinon → dialogue de confirmation → mutation `withdrawFromPot`
///     avec amount = currentAmount (retrait total obligatoire).
/// - Cagnotte CLOSED → "Clôturée", pas de bouton.
class PotsTab extends StatelessWidget {
  const PotsTab({super.key, required this.childId});

  final String childId;

  @override
  Widget build(BuildContext context) {
    return Query(
      options: QueryOptions(
        document: kPotsQuery,
        variables: {'childId': childId},
      ),
      builder: (result, {refetch, fetchMore}) {
        if (result.hasException) {
          return const Center(
              child: Text('Erreur de chargement des cagnottes'));
        }

        if (result.isLoading) {
          return const Center(child: CircularProgressIndicator());
        }

        final list = result.data?['pots'] as List<dynamic>?;
        if (list == null || list.isEmpty) {
          return _buildEmpty(context);
        }

        final pots = list
            .map((e) => Pot.fromJson(e as Map<String, dynamic>))
            .toList();

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: pots.length,
          itemBuilder: (context, index) => _PotCard(
            pot: pots[index],
            childId: childId,
            onWithdrawn: refetch,
          ),
        );
      },
    );
  }

  Widget _buildEmpty(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.savings, size: 64, color: Colors.grey),
          const SizedBox(height: 16),
          Text(
            'Aucune cagnotte',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          const Text(
            'Tes parents peuvent créer des cagnottes pour toi',
            style: TextStyle(color: Colors.grey),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

/// Carte d'une cagnotte avec barre de progression et bouton de retrait.
class _PotCard extends StatefulWidget {
  const _PotCard({
    required this.pot,
    required this.childId,
    this.onWithdrawn,
  });

  final Pot pot;
  final String childId;
  final VoidCallback? onWithdrawn;

  @override
  State<_PotCard> createState() => _PotCardState();
}

class _PotCardState extends State<_PotCard> {
  bool _withdrawing = false;

  Future<void> _withdraw() async {
    final pot = widget.pot;

    // Confirmation : le retrait est total et clôture la cagnotte.
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Retirer la cagnotte'),
        content: Text(
          'Retirer ${pot.currentAmount.toStringAsFixed(2)} € vers ton solde ? '
          'La cagnotte sera clôturée.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Retirer'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _withdrawing = true);

    if (!mounted) return;
    final client = GraphQLProvider.of(context).value;
    try {
      final result = await client.mutate(MutationOptions(
        document: kWithdrawFromPotMutation,
        // amount DOIT être égal à currentAmount (retrait total obligatoire).
        variables: {
          'potId': pot.id,
          'amount': pot.currentAmount,
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
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                '${pot.currentAmount.toStringAsFixed(2)} € retirés vers ton solde',
              ),
            ),
          );
          widget.onWithdrawn?.call();
        }
      }
    } finally {
      if (mounted) setState(() => _withdrawing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pot = widget.pot;
    final progress = pot.progress.clamp(0.0, 1.0);

    // Détermine si le retrait est possible et le message éventuel.
    String? withdrawHint;
    bool canWithdraw = false;

    if (pot.isClosed) {
      // Cagnotte clôturée : pas de bouton.
    } else if (pot.currentAmount <= 0) {
      // Rien à retirer.
    } else if (pot.parentOnly) {
      withdrawHint = 'Seul un parent peut retirer';
    } else if (pot.requiresFull && !pot.isFull) {
      withdrawHint = "Retrait possible une fois l'objectif atteint";
    } else {
      canWithdraw = true;
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    pot.title,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                if (pot.isClosed)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.grey.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Text(
                      'Clôturée',
                      style: TextStyle(color: Colors.grey, fontSize: 12),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            // Barre de progression.
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: progress,
                minHeight: 12,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '${pot.currentAmount.toStringAsFixed(2)} € / ${pot.targetAmount.toStringAsFixed(2)} €',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 4),
            Text(
              'Politique : ${_policyLabel(pot.withdrawalPolicy)}',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.grey,
                  ),
            ),
            // Bouton de retrait ou message.
            if (pot.isClosed || pot.currentAmount > 0) ...[
              const SizedBox(height: 12),
              if (canWithdraw)
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.tonal(
                    onPressed: _withdrawing ? null : _withdraw,
                    child: _withdrawing
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Retirer tout'),
                  ),
                )
              else if (withdrawHint != null)
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.tonal(
                    onPressed: null,
                    child: Text(withdrawHint),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }

  String _policyLabel(String policy) {
    switch (policy) {
      case 'ANYTIME':
        return 'Retrait libre';
      case 'WHEN_FULL':
        return 'Retrait quand pleine';
      case 'PARENT_ONLY':
        return 'Retrait par parent uniquement';
      default:
        return policy;
    }
  }
}
