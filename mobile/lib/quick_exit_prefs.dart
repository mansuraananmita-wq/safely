import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Local quick-exit preferences (not synced to Supabase).
class QuickExitPrefs extends ChangeNotifier {
  static const _shakeKey = 'safely_shake_to_sos';
  static const _fakeCallKey = 'safely_fake_call_shortcut';
  static const _callerKey = 'safely_fake_caller_name';
  static const _delayKey = 'safely_fake_call_delay';

  bool shakeToSos = false;
  bool fakeCallShortcut = true;
  String fakeCallerName = 'Mom';
  int fakeCallDelaySec = 15;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    shakeToSos = prefs.getBool(_shakeKey) ?? false;
    fakeCallShortcut = prefs.getBool(_fakeCallKey) ?? true;
    fakeCallerName = prefs.getString(_callerKey) ?? 'Mom';
    final delay = prefs.getInt(_delayKey) ?? 15;
    fakeCallDelaySec = (delay == 5 || delay == 15 || delay == 30) ? delay : 15;
    notifyListeners();
  }

  Future<void> setShakeToSos(bool value) async {
    shakeToSos = value;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_shakeKey, value);
  }

  Future<void> setFakeCallShortcut(bool value) async {
    fakeCallShortcut = value;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_fakeCallKey, value);
  }

  Future<void> setFakeCallerName(String value) async {
    fakeCallerName = value.trim().isEmpty ? 'Mom' : value.trim();
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_callerKey, fakeCallerName);
  }

  Future<void> setFakeCallDelaySec(int value) async {
    if (value != 5 && value != 15 && value != 30) return;
    fakeCallDelaySec = value;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_delayKey, value);
  }
}
