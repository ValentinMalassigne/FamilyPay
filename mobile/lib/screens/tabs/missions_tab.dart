import 'package:flutter/material.dart';
import 'package:graphql_flutter/graphql_flutter.dart';

import '../../graphql/child_operations.dart';
import '../../models/mission.dart';

/// Onglet Missions : liste des missions avec marquer comme fait.
///
/// - `Query` `missions` → liste des missions de l'enfant.
/// - `PENDING` : bouton "Marquer comme fait" → mutation `markMissionDone`.
/// - `DONE_BY_CHILD` : message "En attente de validation par un parent".
/// - `VALIDATED` : badge "Validée +{reward}€".
/// - `REJECTED` : badge "Refusée".
/// - Pas de bouton de création (réservé au parent côté web).
class MissionsTab extends StatelessWidget {
  const MissionsTab({super.key, required this.childId});

  final String childId;

  @override
  Widget build(BuildContext context) {
    return Query(
      options: QueryOptions(
        document: kMissionsQuery,
        variables: {'childId': childId},
      ),
      builder: (result, {refetch, fetchMore}) {
        if (result.hasException) {
          return const Center(
              child: Text('Erreur de chargement des missions'));
        }

        if (result.isLoading) {
          return const Center(child: CircularProgressIndicator());
        }

        final list = result.data?['missions'] as List<dynamic>?;
        if (list == null || list.isEmpty) {
          return _buildEmpty(context);
        }

        final missions = list
            .map((e) => Mission.fromJson(e as Map<String, dynamic>))
            .toList();

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: missions.length,
          itemBuilder: (context, index) => _MissionCard(
            mission: missions[index],
            childId: childId,
            onDone: refetch,
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
          const Icon(Icons.task_alt, size: 64, color: Colors.grey),
          const SizedBox(height: 16),
          Text(
            'Aucune mission',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          const Text(
            "Tes parents peuvent t'assigner des missions",
            style: TextStyle(color: Colors.grey),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

/// Carte d'une mission avec son statut et son bouton d'action.
class _MissionCard extends StatefulWidget {
  const _MissionCard({
    required this.mission,
    required this.childId,
    this.onDone,
  });

  final Mission mission;
  final String childId;
  final VoidCallback? onDone;

  @override
  State<_MissionCard> createState() => _MissionCardState();
}

class _MissionCardState extends State<_MissionCard> {
  bool _marking = false;

  Future<void> _markDone() async {
    setState(() => _marking = true);

    final client = GraphQLProvider.of(context).value;
    try {
      final result = await client.mutate(MutationOptions(
        document: kMarkMissionDoneMutation,
        variables: {'missionId': widget.mission.id},
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
            const SnackBar(content: Text('Mission marquée comme faite')),
          );
          widget.onDone?.call();
        }
      }
    } finally {
      if (mounted) setState(() => _marking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final mission = widget.mission;

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
                    mission.title,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                Text(
                  '+${mission.reward.toStringAsFixed(2)} €',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _buildStatusBadge(mission),
            if (mission.isPending) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _marking ? null : _markDone,
                  child: _marking
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Marquer comme fait'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatusBadge(Mission mission) {
    if (mission.isPending) {
      return _badge('En attente', Colors.orange);
    }
    if (mission.isDoneByChild) {
      return _badge('En attente de validation par un parent', Colors.blue);
    }
    if (mission.isValidated) {
      return _badge('Validée +${mission.reward.toStringAsFixed(2)} €', Colors.green);
    }
    if (mission.isRejected) {
      return _badge('Refusée', Colors.red);
    }
    return const SizedBox.shrink();
  }

  Widget _badge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w600,
          fontSize: 13,
        ),
      ),
    );
  }
}
