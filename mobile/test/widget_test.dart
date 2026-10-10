import 'package:flutter_test/flutter_test.dart';
import 'package:safely_mobile/campus.dart';
import 'package:safely_mobile/main.dart';

void main() {
  testWidgets('Campus members can open a demo account', (WidgetTester tester) async {
    await tester.pumpWidget(SafelyApp(store: CampusStore()));
    expect(find.text('Amina Rahman'), findsOneWidget);
    expect(find.text('Dr. Karim Hassan'), findsOneWidget);
  });
}
