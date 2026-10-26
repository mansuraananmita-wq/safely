import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:safely_mobile/campus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

bool _listening = false;

/// Requests notification permission and stores this device token.
/// Missing Firebase config is logged and ignored so the rest of the app still runs.
Future<void> registerDevicePush(CampusStore store) async {
  final member = store.member;
  if (member == null || !store.remote) return;
  try {
    if (Firebase.apps.isEmpty) {
      await Firebase.initializeApp();
    }
    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission();
    final token = await messaging.getToken();
    if (token == null || token.isEmpty) {
      debugPrint('Push token skipped: Firebase returned no token.');
      return;
    }
    await _saveToken(member.id, token);
    if (_listening) return;
    _listening = true;
    messaging.onTokenRefresh.listen((next) {
      final current = store.member;
      if (current == null) return;
      unawaited(_saveToken(current.id, next));
    });
  } catch (error) {
    debugPrint('Push token skipped: $error');
  }
}

Future<void> _saveToken(String userId, String token) async {
  await Supabase.instance.client.from('device_tokens').upsert({
    'user_id': userId,
    'token': token,
    'platform': _platform(),
    'updated_at': DateTime.now().toUtc().toIso8601String(),
  });
}

String _platform() {
  switch (defaultTargetPlatform) {
    case TargetPlatform.android:
      return 'android';
    case TargetPlatform.iOS:
      return 'ios';
    default:
      return 'other';
  }
}
