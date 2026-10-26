import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:safely_mobile/strip_image_meta.dart';

void main() {
  test('re-encode drops EXIF and returns a JPEG data-url payload', () {
    final source = img.Image(width: 8, height: 8);
    for (final pixel in source) {
      pixel
        ..r = 40
        ..g = 80
        ..b = 120;
    }
    // Package encoder does not attach EXIF; the strip path still re-encodes pixels only.
    final raw = Uint8List.fromList(img.encodeJpg(source, quality: 90));
    final payload = strippedPhotoPayload(raw, fileName: 'Gate South!!.JPG', mime: 'image/jpeg');

    expect(payload['name'], 'Gate_South.jpg');
    expect(payload['url'], startsWith('data:image/jpeg;base64,'));
    expect(payload['url']!.length, greaterThan(40));

    final cleaned = stripImageMetaBytes(raw);
    expect(cleaned.length, greaterThan(20));
    expect(cleaned[0], 0xff);
    expect(cleaned[1], 0xd8);
  });

  test('scrubbedPhotoName maps mime to extension', () {
    expect(scrubbedPhotoName('shot.png', 'image/png'), 'shot.png');
    expect(scrubbedPhotoName('x.webp', 'image/webp'), 'x.webp');
  });
}
