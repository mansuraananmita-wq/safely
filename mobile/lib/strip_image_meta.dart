import 'dart:convert';
import 'dart:typed_data';

import 'package:image/image.dart' as img;

/// Re-encode an image so EXIF/GPS and other embedded metadata are dropped.
/// The optional device map pin on a report is separate and is never read from the file.
Uint8List stripImageMetaBytes(Uint8List bytes, {String preferredMime = 'image/jpeg'}) {
  final decoded = img.decodeImage(bytes);
  if (decoded == null) {
    throw StateError('Could not decode image');
  }
  // decodeImage does not keep EXIF on the Image; re-encoding writes pixels only.
  if (preferredMime == 'image/png') {
    return Uint8List.fromList(img.encodePng(decoded));
  }
  if (preferredMime == 'image/webp') {
    return Uint8List.fromList(img.encodeJpg(decoded, quality: 92));
  }
  return Uint8List.fromList(img.encodeJpg(decoded, quality: 92));
}

String scrubbedPhotoName(String original, String mime) {
  var base = original
      .replaceAll(RegExp(r'\.[^.]+$'), '')
      .replaceAll(RegExp(r'[^\w.-]+'), '_')
      .replaceAll(RegExp(r'_+'), '_')
      .replaceAll(RegExp(r'^_|_$'), '');
  if (base.length > 48) base = base.substring(0, 48);
  final safe = base.isEmpty ? 'photo' : base;
  final ext = mime == 'image/png' ? 'png' : mime == 'image/webp' ? 'webp' : 'jpg';
  return '$safe.$ext';
}

/// Build a data-URL photo payload matching the website report photos shape.
Map<String, String> strippedPhotoPayload(Uint8List raw, {required String fileName, String mime = 'image/jpeg'}) {
  final exportMime = mime == 'image/png' ? 'image/png' : 'image/jpeg';
  final cleaned = stripImageMetaBytes(raw, preferredMime: exportMime);
  final name = scrubbedPhotoName(fileName, exportMime);
  final b64 = base64Encode(cleaned);
  return {'name': name, 'url': 'data:$exportMime;base64,$b64'};
}
