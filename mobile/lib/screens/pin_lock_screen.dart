import 'dart:math';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/lock_service.dart';
import '../widgets/pin_keypad.dart';

/// Écran de verrouillage par code PIN.
///
/// Affiche 4 points + clavier numérique. Dès que 4 chiffres sont saisis,
/// on vérifie automatiquement via [LockService.verifyPin]. Si le PIN est
/// correct, l'app se déverrouille (l'AuthGate rebascule vers HomeScreen).
/// Si le PIN est faux, on déclenche une animation de secousse (shake) et
/// on vide les chiffres.
///
/// Le bouton biométrique (empreinte / Face ID) est ajouté dans le commit 3.
class PinLockScreen extends StatefulWidget {
  const PinLockScreen({super.key});

  @override
  State<PinLockScreen> createState() => _PinLockScreenState();
}

class _PinLockScreenState extends State<PinLockScreen>
    with SingleTickerProviderStateMixin {
  String _input = '';
  bool _error = false;

  // Animation de secousse quand le PIN est erroné.
  late final AnimationController _shakeController;

  @override
  void initState() {
    super.initState();
    _shakeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
  }

  @override
  void dispose() {
    _shakeController.dispose();
    super.dispose();
  }

  void _onKeyPressed(String digit) {
    if (_input.length >= 4 || _shakeController.isAnimating) return;
    setState(() {
      _input += digit;
      _error = false;
    });
    if (_input.length == 4) {
      _verifyPin();
    }
  }

  void _onDeletePressed() {
    if (_input.isEmpty) return;
    setState(() {
      _input = _input.substring(0, _input.length - 1);
      _error = false;
    });
  }

  Future<void> _verifyPin() async {
    final lockService = context.read<LockService>();
    final ok = await lockService.verifyPin(_input);
    if (!ok && mounted) {
      // PIN erroné : animation de secousse + on vide les chiffres.
      setState(() => _error = true);
      _shakeController.forward(from: 0).then((_) {
        if (mounted) setState(() => _input = '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 80),
            const Icon(Icons.lock_outline, size: 48),
            const SizedBox(height: 16),
            Text(
              'Saisis ton code PIN',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 32),
            // Wrap the dot row in an AnimatedBuilder for the shake effect.
            AnimatedBuilder(
              animation: _shakeController,
              builder: (context, child) {
                // Oscillation sinusoidale : amplitude décroissante avec
                // elasticOut, multipliée par un sin pour aller gauche/droite.
                final t = _shakeController.value;
                final amplitude = (1 - t) * 12;
                final dx = amplitude * sin(t * pi * 6);
                return Transform.translate(
                  offset: Offset(dx, 0),
                  child: child,
                );
              },
              child: PinDotRow(filled: _input.length, error: _error),
            ),
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
