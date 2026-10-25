import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:safely_mobile/sos_panel.dart';

void main() {
  testWidgets('SOS countdown cancel stops before send', (WidgetTester tester) async {
    var completed = false;
    var cancelled = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SosCountdown(
            seconds: 3,
            onCancel: () => cancelled = true,
            onComplete: () => completed = true,
          ),
        ),
      ),
    );

    expect(find.text('3'), findsOneWidget);
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('2'), findsOneWidget);

    await tester.tap(find.byKey(const Key('sos-countdown-cancel')));
    await tester.pump();

    expect(cancelled, isTrue);
    expect(completed, isFalse);

    await tester.pump(const Duration(seconds: 5));
    expect(completed, isFalse);
  });
}
