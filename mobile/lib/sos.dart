// Shared SOS helpers matching the website (`src/lib/sos.ts` / desk status).

const liveMaxM = 1000.0;

class LiveFix {
  const LiveFix({required this.lat, required this.lng, required this.accuracy, required this.at});

  final double lat;
  final double lng;
  final double accuracy;
  final DateTime at;
}

bool isPreciseFix(LiveFix? fix) => fix != null && fix.accuracy > 0 && fix.accuracy <= liveMaxM;

LiveFix? preferLiveFix(LiveFix? previous, LiveFix next) {
  if (!isPreciseFix(next)) return isPreciseFix(previous) ? previous : null;
  if (!isPreciseFix(previous)) return next;
  if (next.accuracy + 5 < previous!.accuracy) return next;
  if (!next.at.isBefore(previous.at) && next.accuracy <= previous.accuracy + 25) return next;
  return previous;
}

String sosMessage(String name, LiveFix? place) {
  final where = place == null
      ? 'Location was not available.'
      : 'https://maps.google.com/?q=${place.lat.toStringAsFixed(6)},${place.lng.toStringAsFixed(6)}';
  return 'Safely SOS. $name needs help now. $where This does not call 999.';
}

/// Prefill body for the phone SMS app when SOS cannot reach the server.
/// Never auto-sends — the person must press Send in the SMS app.
String offlineSosSmsBody(String name, LiveFix? place) {
  if (place == null) {
    return 'Safely SOS. $name needs help now. Location was not available. This does not call 999.';
  }
  final lat = place.lat.toStringAsFixed(6);
  final lng = place.lng.toStringAsFixed(6);
  final maps = 'https://maps.google.com/?q=$lat,$lng';
  return 'Safely SOS. $name needs help now. Coordinates: $lat, $lng. Map: $maps This does not call 999.';
}

/// Opens the device SMS composer. Does not send silently.
Uri offlineSosSmsUri(String securityNumber, String body) {
  final digits = securityNumber.replaceAll(RegExp(r'[^\d+]'), '');
  return Uri.parse('sms:$digits?body=${Uri.encodeComponent(body)}');
}

bool isUsableSecuritySmsNumber(String raw) {
  final digits = raw.replaceAll(RegExp(r'[^\d+]'), '');
  if (digits.isEmpty || digits.contains('X') || digits.contains('x')) return false;
  final onlyDigits = digits.replaceAll('+', '');
  return onlyDigits.length >= 7;
}

enum SosDeskStatus { sent, seen, solved }

SosDeskStatus sosDeskStatus({DateTime? seenAt, DateTime? resolvedAt}) {
  if (resolvedAt != null) return SosDeskStatus.solved;
  if (seenAt != null) return SosDeskStatus.seen;
  return SosDeskStatus.sent;
}

String sosDeskStatusLabel(SosDeskStatus status, String Function(String en, String bn) tx) {
  switch (status) {
    case SosDeskStatus.solved:
      return tx('Solved', 'সমাধান হয়েছে');
    case SosDeskStatus.seen:
      return tx('Seen by desk', 'ডেস্ক দেখেছে');
    case SosDeskStatus.sent:
      return tx('Sent', 'পাঠানো হয়েছে');
  }
}

class SosAlert {
  SosAlert({
    required this.id,
    required this.userId,
    required this.senderName,
    this.lat,
    this.lng,
    this.accuracyM,
    required this.message,
    required this.createdAt,
    this.seenAt,
    this.resolvedAt,
    this.smsStatus = 'pending',
    this.smsDetail = '',
  });

  final String id;
  final String userId;
  final String senderName;
  final double? lat;
  final double? lng;
  final double? accuracyM;
  final String message;
  final DateTime createdAt;
  final DateTime? seenAt;
  final DateTime? resolvedAt;
  final String smsStatus;
  final String smsDetail;

  SosDeskStatus get deskStatus => sosDeskStatus(seenAt: seenAt, resolvedAt: resolvedAt);

  factory SosAlert.fromRow(Map<String, dynamic> row) {
    DateTime? parse(Object? value) {
      if (value == null) return null;
      return DateTime.tryParse(value.toString())?.toLocal();
    }

    return SosAlert(
      id: row['id'] as String,
      userId: row['user_id'] as String,
      senderName: row['sender_name'] as String? ?? '',
      lat: (row['lat'] as num?)?.toDouble(),
      lng: (row['lng'] as num?)?.toDouble(),
      accuracyM: (row['accuracy_m'] as num?)?.toDouble(),
      message: row['message'] as String? ?? '',
      createdAt: parse(row['created_at']) ?? DateTime.now(),
      seenAt: parse(row['seen_at']),
      resolvedAt: parse(row['resolved_at']),
      smsStatus: row['sms_status'] as String? ?? 'pending',
      smsDetail: row['sms_detail'] as String? ?? '',
    );
  }
}

enum SosSendKind { sent, desk, smsFailed, soon, rejected, offline }

class SosSendResult {
  const SosSendResult({required this.kind, this.id, this.detail});

  final SosSendKind kind;
  final String? id;
  final String? detail;

  factory SosSendResult.offline() => const SosSendResult(
        kind: SosSendKind.offline,
        detail: 'You are offline. The SOS was not sent.',
      );
}

String newSosId() {
  final body = DateTime.now().microsecondsSinceEpoch.toRadixString(36);
  return 'sos$body';
}
