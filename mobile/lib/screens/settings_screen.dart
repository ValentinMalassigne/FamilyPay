import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../services/lock_service.dart';

/// Écran des réglages : changement de code PIN, activation/désactivation
/// de la biométrie, et déconnexion.
///
/// Poussé depuis l'app bar de HomeScreen via `Navigator.push`.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  @override
  Widget build(BuildContext context) {
    final lockService = context.watch<LockService>();
    final authService = context.read<AuthService>();

    return Scaffold(
      appBar: AppBar(title: const Text('Réglages')),
      body: ListView(
        children: [
          ListTile(
            leading: const Icon(Icons.lock_outline),
            title: const Text('Changer le code PIN'),
            onTap: () => _showChangePinDialog(context),
          ),
          // Le toggle biométrique ne s'affiche que si le device le supporte.
          if (lockService.biometricAvailable)
            SwitchListTile(
              secondary: const Icon(Icons.fingerprint),
              title: const Text('Déverrouillage biométrique'),
              subtitle: const Text('Empreinte / Face ID'),
              value: lockService.biometricEnabled,
              onChanged: (value) async {
                if (value) {
                  // Activation : on vérifie que la biométrie fonctionne avant
                  // d'activer (demande une auth réussie).
                  final ok =
                      await lockService.authenticateWithBiometrics();
                  if (ok && context.mounted) {
                    await lockService.enableBiometric();
                  }
                } else {
                  await lockService.disableBiometric();
                }
              },
            ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.red),
            title: const Text('Déconnexion',
                style: TextStyle(color: Colors.red)),
            onTap: () async {
              // La déconnexion efface la session ET le code PIN.
              await lockService.clearPin();
              await authService.logout();
            },
          ),
        ],
      ),
    );
  }

  /// Dialogue de changement de PIN : ancien PIN + nouveau PIN + confirmation.
  Future<void> _showChangePinDialog(BuildContext context) async {
    final oldController = TextEditingController();
    final newController = TextEditingController();
    final confirmController = TextEditingController();
    String? error;

    await showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Text('Changer le code PIN'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: oldController,
                keyboardType: TextInputType.number,
                obscureText: true,
                maxLength: 4,
                decoration: const InputDecoration(
                  labelText: 'Ancien code PIN',
                  counterText: '',
                ),
              ),
              TextField(
                controller: newController,
                keyboardType: TextInputType.number,
                obscureText: true,
                maxLength: 4,
                decoration: const InputDecoration(
                  labelText: 'Nouveau code PIN',
                  counterText: '',
                ),
              ),
              TextField(
                controller: confirmController,
                keyboardType: TextInputType.number,
                obscureText: true,
                maxLength: 4,
                decoration: InputDecoration(
                  labelText: 'Confirmer',
                  counterText: '',
                  errorText: error,
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Annuler'),
            ),
            FilledButton(
              onPressed: () async {
                final oldPin = oldController.text;
                final newPin = newController.text;
                final confirm = confirmController.text;
                if (newPin.length != 4) {
                  setState(() => error = 'Le code doit faire 4 chiffres');
                  return;
                }
                if (newPin != confirm) {
                  setState(() => error = 'Les codes ne correspondent pas');
                  return;
                }
                final lockService = context.read<LockService>();
                final ok = await lockService.changePin(oldPin, newPin);
                if (!ok) {
                  setState(() => error = 'Ancien code incorrect');
                  return;
                }
                if (ctx.mounted) Navigator.of(ctx).pop();
              },
              child: const Text('Valider'),
            ),
          ],
        ),
      ),
    );
  }
}
