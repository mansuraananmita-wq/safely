import 'package:flutter_test/flutter_test.dart';
import 'package:safely_mobile/sos.dart';

void main() {
  test('live share pushes a walk and ignores GPS jitter and city pins', () {
    final sent = LiveFix(lat: 23.810331, lng: 90.412521, accuracy: 12, at: DateTime(2026, 1, 1));
    final walked = LiveFix(lat: 23.810800, lng: 90.412900, accuracy: 18, at: DateTime(2026, 1, 1, 0, 0, 8));
    final jitter = LiveFix(lat: 23.810332, lng: 90.412522, accuracy: 14, at: DateTime(2026, 1, 1, 0, 0, 2));
    final city = LiveFix(lat: 23.7942, lng: 90.4097, accuracy: 8000, at: DateTime(2026, 1, 1, 0, 0, 9));
    expect(shouldPushLiveFix(sent, walked), isTrue);
    expect(shouldPushLiveFix(sent, jitter), isFalse);
    expect(shouldPushLiveFix(sent, city), isFalse);
  });
}
