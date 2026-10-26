import 'package:flutter_test/flutter_test.dart';
import 'package:safely_mobile/sos.dart';

void main() {
  test('offline SOS SMS body includes name, coordinates, and maps link', () {
    final place = LiveFix(lat: 23.780887, lng: 90.407268, accuracy: 12, at: DateTime(2026, 1, 1));
    final body = offlineSosSmsBody('Amina Rahman', place);
    expect(body, contains('Amina Rahman'));
    expect(body, contains('23.780887'));
    expect(body, contains('90.407268'));
    expect(body, contains('https://maps.google.com/?q=23.780887,90.407268'));
    expect(body, contains('does not call 999'));
  });

  test('offline SOS SMS uri opens composer and does not auto-send', () {
    final uri = offlineSosSmsUri('01712345678', 'Safely SOS. Help.');
    expect(uri.scheme, 'sms');
    expect(uri.toString(), startsWith('sms:01712345678'));
    expect(uri.toString(), contains('body='));
    expect(uri.toString(), isNot(contains('send=1')));
  });

  test('placeholder security numbers are not usable', () {
    expect(isUsableSecuritySmsNumber('01XXXXXXXXX'), isFalse);
    expect(isUsableSecuritySmsNumber(''), isFalse);
    expect(isUsableSecuritySmsNumber('01712345678'), isTrue);
  });
}
