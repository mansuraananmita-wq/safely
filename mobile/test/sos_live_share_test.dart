import 'package:flutter_test/flutter_test.dart';
import 'package:safely_mobile/sos.dart';

void main() {
  test('live share pushes a walk and ignores GPS jitter and city pins', () {
    final sent = LiveFix(lat: 23.810331, lng: 90.412521, accuracy: 12, at: DateTime(2026, 1, 1));
    final walked = LiveFix(lat: 23.810800, lng: 90.412900, accuracy: 18, at: DateTime(2026, 1, 1, 0, 0, 8));
    final jitter = LiveFix(lat: 23.810332, lng: 90.412522, accuracy: 14, at: DateTime(2026, 1, 1, 0, 0, 2));
    final city = LiveFix(lat: 23.7942, lng: 90.4097, accuracy: 8000, at: DateTime(2026, 1, 1, 0, 0, 9));
    final neighbourhood = LiveFix(lat: 24.071, lng: 90.219, accuracy: 500, at: DateTime(2026, 1, 1, 0, 0, 4));
    expect(shouldPushLiveFix(sent, walked), isTrue);
    expect(shouldPushLiveFix(sent, jitter), isFalse);
    expect(shouldPushLiveFix(sent, city), isFalse);
    expect(isPreciseFix(neighbourhood), isFalse);
    expect(shouldPushLiveFix(sent, neighbourhood), isFalse);
  });

  test('Wi-Fi hall pin is not GPS and does not overwrite a GPS share', () {
    final gps = LiveFix(
      lat: 24.0615424,
      lng: 90.2201434,
      accuracy: 8,
      at: DateTime(2026, 1, 1),
      altitudeAccuracy: 4,
    );
    final hallWifi = LiveFix(
      lat: 24.071387,
      lng: 90.216199,
      accuracy: 62,
      at: DateTime(2026, 1, 1, 0, 0, 8),
    );
    expect(locationSource(hallWifi), LocationSource.wifi);
    expect(isGpsFix(gps), isTrue);
    expect(sendDecision(hallWifi, 0, false), SosSendDecision.confirm);
    expect(sendDecision(gps, 0, false), SosSendDecision.send);
    expect(shouldPushLiveFix(gps, hallWifi), isFalse);
    expect(preferLiveFix(hallWifi, gps), gps);
  });
}
