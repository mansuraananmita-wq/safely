import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sensors_plus/sensors_plus.dart';
import 'package:safely_mobile/shake_sos.dart';

void main() {
  testWidgets('shake only starts the countdown', (WidgetTester tester) async {
    var sendInvoked = false;
    // sync: true so accelerometer samples reach the listener before the next pump.
    final shakes = StreamController<AccelerometerEvent>.broadcast(sync: true);
    addTearDown(shakes.close);

    await tester.pumpWidget(
      MaterialApp(
        home: ShakeSosCountdownHost(
          enabled: true,
          accelerometerStream: shakes.stream,
          onSend: () => sendInvoked = true,
        ),
      ),
    );

    expect(find.text('waiting'), findsOneWidget);
    expect(find.byKey(const Key('sos-countdown-cancel')), findsNothing);
    expect(sendInvoked, isFalse);

    final now = DateTime.now();
    shakes.add(AccelerometerEvent(0, 0, 0, now));
    shakes.add(AccelerometerEvent(25, 0, 0, now.add(const Duration(milliseconds: 40))));
    await tester.pump();

    expect(find.byKey(const Key('sos-countdown-cancel')), findsOneWidget);
    expect(find.text('3'), findsOneWidget);
    expect(sendInvoked, isFalse);

    await tester.tap(find.byKey(const Key('sos-countdown-cancel')));
    await tester.pump();

    expect(sendInvoked, isFalse);
    expect(find.text('waiting'), findsOneWidget);

    await tester.pump(const Duration(seconds: 5));
    expect(sendInvoked, isFalse);
  });
}
