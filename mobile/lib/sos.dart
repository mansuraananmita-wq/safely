// Shared SOS helpers matching the website (`src/lib/sos.ts` / desk status).

import 'dart:math';

const liveMaxM = 150.0;
const liveShareMs = 180000;
const liveMoveM = 15.0;
const liveAccuracySlackM = 80.0;

class LiveFix {
  const LiveFix({
    required this.lat,
    required this.lng,
    required this.accuracy,
    required this.at,
    this.altitude,
    this.altitudeAccuracy,
    this.speed,
  });

  final double lat;
  final double lng;
  final double accuracy;
  final DateTime at;
  final double? altitude;
  final double? altitudeAccuracy;
  final double? speed;
}

enum LocationSource { gps, wifi, coarse }

LocationSource locationSource(LiveFix? fix) {
  if (!isPreciseFix(fix)) return LocationSource.coarse;
  final measuredHeight = fix!.altitudeAccuracy != null && fix.altitudeAccuracy!.isFinite && fix.altitudeAccuracy! > 0;
  final moving = fix.speed != null && fix.speed!.isFinite && fix.speed! > 0.4;
  if (measuredHeight || moving) return LocationSource.gps;
  return LocationSource.wifi;
}

bool isGpsFix(LiveFix? fix) => locationSource(fix) == LocationSource.gps;

bool isPreciseFix(LiveFix? fix) => fix != null && fix.accuracy > 0 && fix.accuracy <= liveMaxM;

LiveFix? preferLiveFix(LiveFix? previous, LiveFix next) {
  if (!isPreciseFix(next)) return isPreciseFix(previous) ? previous : null;
  if (!isPreciseFix(previous)) return next;
  if (locationSource(next) == LocationSource.gps && locationSource(previous) != LocationSource.gps) return next;
  if (locationSource(previous) == LocationSource.gps && locationSource(next) != LocationSource.gps) return previous;
  if (next.accuracy + 5 < previous!.accuracy) return next;
  if (!next.at.isBefore(previous.at) && next.accuracy <= previous.accuracy + 25) return next;
  return previous;
}

double metersBetween(LiveFix a, LiveFix b) {
  const radius = 6371000.0;
  final dLat = (b.lat - a.lat) * pi / 180;
  final dLng = (b.lng - a.lng) * pi / 180;
  final hav = sin(dLat / 2) * sin(dLat / 2) +
      cos(a.lat * pi / 180) * cos(b.lat * pi / 180) * sin(dLng / 2) * sin(dLng / 2);
  return 2 * radius * asin(sqrt(hav.clamp(0, 1)));
}

bool shouldPushLiveFix(LiveFix? sent, LiveFix next) {
  if (!isPreciseFix(next)) return false;
  if (!isPreciseFix(sent)) return true;
  if (locationSource(sent) == LocationSource.gps && locationSource(next) != LocationSource.gps) return false;
  if (next.accuracy > sent!.accuracy + liveAccuracySlackM) return false;
  if (next.accuracy + 5 < sent.accuracy) return true;
  return metersBetween(sent, next) >= liveMoveM;
}

enum SosSendDecision { wait, send, confirm, blocked }

SosSendDecision sendDecision(LiveFix? fix, int waitedMs, bool denied) {
  if (isGpsFix(fix)) return SosSendDecision.send;
  if (isPreciseFix(fix)) return SosSendDecision.confirm;
  if (denied && waitedMs >= 8000) return SosSendDecision.blocked;
  if (waitedMs >= 25000) return SosSendDecision.blocked;
  return SosSendDecision.wait;
}

String mapsPinHref(double lat, double lng) {
  final q = '${lat.toStringAsFixed(6)},${lng.toStringAsFixed(6)}';
  return 'https://www.google.com/maps?q=$q&ll=$q&z=18';
}

String osmEmbedHref(double lat, double lng) {
  const delta = 0.003;
  return 'https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta},${lat - delta},${lng + delta},${lat + delta}&layer=mapnik&marker=$lat,$lng';
}

String sosMessage(String name, LiveFix? place) {
  final where = place == null
      ? 'Location was not available.'
      : mapsPinHref(place.lat, place.lng);
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
  final maps = mapsPinHref(place.lat, place.lng);
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
