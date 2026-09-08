import 'package:flutter/material.dart';

/// Affiche 4 points : remplis selon le nombre de chiffres saisis.
/// Réutilisé par PinSetupScreen et PinLockScreen.
class PinDotRow extends StatelessWidget {
  const PinDotRow({
    super.key,
    required this.filled,
    this.error = false,
  });

  /// Nombre de chiffres actuellement saisis (0 à 4).
  final int filled;

  /// Si true, les points s'affichent en rouge (PIN erroné).
  final bool error;

  @override
  Widget build(BuildContext context) {
    final color = error
        ? Theme.of(context).colorScheme.error
        : Theme.of(context).colorScheme.primary;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(4, (i) {
        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 12),
          width: 16,
          height: 16,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: i < filled ? color : Colors.transparent,
            border: Border.all(color: color, width: 2),
          ),
        );
      }),
    );
  }
}

/// Clavier numérique 0-9 + bouton supprimer.
/// Réutilisé par PinSetupScreen et PinLockScreen.
class PinKeypad extends StatelessWidget {
  const PinKeypad({
    super.key,
    required this.onKeyPressed,
    required this.onDeletePressed,
  });

  final ValueChanged<String> onKeyPressed;
  final VoidCallback onDeletePressed;

  @override
  Widget build(BuildContext context) {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 48),
      child: Column(
        children: [
          for (final row in [
            keys.sublist(0, 3),
            keys.sublist(3, 6),
            keys.sublist(6, 9),
          ])
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: row
                    .map((k) => _KeyButton(digit: k, onTap: () => onKeyPressed(k)))
                    .toList(),
              ),
            ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              const SizedBox(width: 72, height: 72),
              _KeyButton(digit: '0', onTap: () => onKeyPressed('0')),
              IconButton(
                icon: const Icon(Icons.backspace_outlined),
                iconSize: 28,
                onPressed: onDeletePressed,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Bouton circulaire pour un chiffre du clavier.
class _KeyButton extends StatelessWidget {
  const _KeyButton({required this.digit, required this.onTap});

  final String digit;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(36),
      child: Container(
        width: 72,
        height: 72,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
        ),
        child: Text(
          digit,
          style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w500),
        ),
      ),
    );
  }
}
