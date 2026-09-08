import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Service de notifications locales (OS-level) pour FamilyPay.
///
/// Affiche des notifications système quand l'app reçoit une mise à jour temps
/// réel via WebSocket (solde mis à jour, nouvelle transaction), en plus du
/// SnackBar in-app. Contrairement au SnackBar, la notification OS reste
/// visible même si l'app est en arrière-plan (tant que le process est vivant,
/// le WebSocket reste ouvert).
///
/// Singleton : une seule instance partage le plugin et le canal de notif.
class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  // ID du canal Android (obligatoire depuis Android 8 / Oreo). Les notifs
  // sans canal valide sont simplement ignorées par le système.
  static const _channelId = 'familypay_updates';
  static const _channelName = 'FamilyPay — Mises à jour';

  final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();

  bool _initialized = false;

  /// Initialise le plugin. À appeler une fois au démarrage (dans `main`),
  /// avant toute subscription qui pourrait déclencher une notification.
  Future<void> init() async {
    if (_initialized) return;

    // Configuration Android : le canal est créé par le plugin lui-même avec
    // l'importance HIGH (bannière + son). Pas besoin de modifier le manifest.
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    await _plugin.initialize(
      const InitializationSettings(android: androidInit, iOS: iosInit),
    );

    // Sur Android 13+, la permission de notification doit être demandée
    // explicitement à l'exécution. `requestNotificationsPermission` gère
    // le no-op sur les versions antérieures.
    await _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();

    _initialized = true;
  }

  /// Affiche une notification locale immédiate.
  ///
  /// [id] basé sur le timestamp pour éviter d'écraser une notif précédente
  /// si plusieurs arrivent en rafale.
  Future<void> show(String title, String body) async {
    if (!_initialized) return;

    await _plugin.show(
      DateTime.now().millisecondsSinceEpoch.remainder(100000),
      title,
      body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          _channelName,
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(),
      ),
    );
  }
}
