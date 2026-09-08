import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/lock_service.dart';
import '../widgets/pin_keypad.dart';

/// Écran de création de code PIN (première utilisation).
///
/// Deux étapes :
///   1. L'utilisateur saisit un code à 4 chiffres.
///   2. L'utilisateur confirme en resaisissant le même code.
///
/// Si les deux codes correspondent, [LockService.setPin] est appelé (hashe +
/// persiste le PIN), ce qui déverrouille l'app — l'AuthGate rebascule alors
/// vers HomeScreen.
///
/// Si le device supporte la biométrie (Touch ID / Face ID / empreinte), un
/// prompt d'opt-in s'affiche après la création du PIN : l'utilisateur peut
/// activer le déverrouillage biométrique (modifiable plus tard dans les
/// réglages).
class PinSetupScreen extends StatefulWidget {
  const PinSetupScreen({super.key});

  @override
  State<PinSetupScreen> createState() => _PinSetupScreenState();
}

class _PinSetupScreenState extends State<PinSetupScreen> {
  /// Étape courante : 1 = saisie, 2 = confirmation.
  int _step = 1;
  String _firstPin = '';
  String _currentInput = '';
  String _errorText = '';

  void _onKeyPressed(String digit) {
    if (_currentInput.length >= 4) return;
    setState(() {
      _currentInput += digit;
      _errorText = '';
    });
    if (_currentInput.length == 4) {
      _onPinComplete();
    }
  }

  void _onDeletePressed() {
    if (_currentInput.isEmpty) return;
    setState(() {
      _currentInput = _currentInput.substring(0, _currentInput.length - 1);
      _errorText = '';
    });
  }

  Future<void> _onPinComplete() async {
    if (_step == 1) {
      // Première saisie : on stocke et passe à la confirmation.
      _firstPin = _currentInput;
      setState(() {
        _step = 2;
        _currentInput = '';
      });
    } else {
      // Confirmation : on compare avec la première saisie.
      if (_currentInput == _firstPin) {
        final lockService = context.read<LockService>();
        // Si le device supporte la biométrie, on propose l'opt-in avant de
        // déverrouiller (setPin déclenche le rebasculement vers HomeScreen).
        if (lockService.biometricAvailable) {
          final enable = await _showBiometricOptIn();
          if (enable == true) {
            await lockService.enableBiometric();
          }
        }
        await lockService.setPin(_currentInput);
        // L'AuthGate va rebasculer vers HomeScreen (pinSet=true, unlocked=true).
      } else {
        // Mismatch : on recommence depuis l'étape 1.
        setState(() {
          _step = 1;
          _firstPin = '';
          _currentInput = '';
          _errorText = 'Les codes ne correspondent pas. Réessaie.';
        });
      }
    }
  }

  /// Affiche un dialogue demandant à l'utilisateur s'il veut activer le
  /// déverrouillage biométrique. Retourne true si l'utilisateur accepte.
  Future<bool?> _showBiometricOptIn() {
    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('Déverrouillage biométrique'),
        content: const Text(
          'Veux-tu activer le déverrouillage par empreinte ou Face ID ? '
          'Tu pourras toujours utiliser ton code PIN en fallback.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Plus tard'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Activer'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final title =
        _step == 1 ? 'Crée ton code PIN' : 'Confirme ton code PIN';

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 60),
            Text(title, style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 12),
            Text(
              _errorText,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
            const SizedBox(height: 32),
            PinDotRow(filled: _currentInput.length),
            const Spacer(),
            PinKeypad(
              onKeyPressed: _onKeyPressed,
              onDeletePressed: _onDeletePressed,
            ),
            const SizedBox(height: 48),
          ],
        ),
      ),
    );
  }
}
