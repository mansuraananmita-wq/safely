import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:safely_mobile/campus.dart';
import 'package:safely_mobile/live_map.dart';
import 'package:safely_mobile/sos.dart';
import 'package:url_launcher/url_launcher.dart';

Future<void> dialEmergency999() async {
  final uri = Uri(scheme: 'tel', path: '999');
  await launchUrl(uri);
}

Future<void> openOfflineSosSms({
  required String name,
  required String securityNumber,
  LiveFix? place,
}) async {
  if (!isUsableSecuritySmsNumber(securityNumber)) return;
  final uri = offlineSosSmsUri(securityNumber, offlineSosSmsBody(name, place));
  await launchUrl(uri);
}

/// 3-second cancelable countdown used by SOS (and covered by a widget test).
class SosCountdown extends StatefulWidget {
  const SosCountdown({
    super.key,
    required this.seconds,
    required this.onCancel,
    required this.onComplete,
    this.cancelLabel = 'Cancel',
    this.child,
  });

  final int seconds;
  final VoidCallback onCancel;
  final VoidCallback onComplete;
  final String cancelLabel;
  final Widget? child;

  @override
  State<SosCountdown> createState() => _SosCountdownState();
}

class _SosCountdownState extends State<SosCountdown> {
  late int _left;
  Timer? _timer;
  bool _finished = false;

  @override
  void initState() {
    super.initState();
    _left = widget.seconds;
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      if (_left <= 1) {
        timer.cancel();
        if (_finished) return;
        _finished = true;
        setState(() => _left = 0);
        widget.onComplete();
        return;
      }
      setState(() => _left -= 1);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _cancel() {
    _timer?.cancel();
    if (_finished) return;
    _finished = true;
    widget.onCancel();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          '$_left',
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 64, fontWeight: FontWeight.w700, color: Color(0xFFB42318)),
        ),
        if (widget.child != null) ...[
          const SizedBox(height: 12),
          widget.child!,
        ],
        const SizedBox(height: 16),
        OutlinedButton(
          key: const Key('sos-countdown-cancel'),
          onPressed: _cancel,
          child: Text(widget.cancelLabel),
        ),
      ],
    );
  }
}

class SosHomeSection extends StatefulWidget {
  const SosHomeSection({super.key, required this.store});

  final CampusStore store;

  @override
  State<SosHomeSection> createState() => _SosHomeSectionState();
}

class _SosHomeSectionState extends State<SosHomeSection> {
  @override
  void initState() {
    super.initState();
    widget.store.refreshSosAlerts();
  }

  Future<void> _openSos() async {
    final store = widget.store;
    final tx = store.tx;
    final allowed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(tx('Location for SOS', 'SOS-এর লোকেশন')),
        content: Text(
          tx(
            'Safely needs your live GPS so the campus desk can find you. Readings worse than 1 kilometre are ignored. SOS does not call 999.',
            'ডেস্ক আপনাকে খুঁজে পেতে Safely-এর লাইভ GPS লাগে। ১ কিলোমিটারের চেয়ে খারাপ রিডিং বাদ। SOS ৯৯৯-এ কল করে না।',
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: Text(tx('Not now', 'এখন নয়'))),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(tx('Continue', 'চালিয়ে যান'))),
        ],
      ),
    );
    if (allowed != true || !mounted) return;

    await openSosFlow(context, store);
  }

  @override
  Widget build(BuildContext context) {
    final store = widget.store;
    final tx = store.tx;
    final alerts = store.mySosAlerts();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFFFF1F0),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFF0C2BD)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                tx(
                  'SOS does not call 999. If someone is in danger, call 999 yourself.',
                  'SOS ৯৯৯-এ কল করে না। কেউ বিপদে থাকলে নিজে ৯৯৯-এ কল করুন।',
                ),
                style: const TextStyle(height: 1.35, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: dialEmergency999,
                icon: const Icon(Icons.phone),
                label: Text(tx('Call 999', '৯৯৯-এ কল')),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFFB42318),
            foregroundColor: Colors.white,
            minimumSize: const Size.fromHeight(64),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          ),
          onPressed: _openSos,
          child: Text(tx('SOS', 'এসওএস'), style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700)),
        ),
        const SizedBox(height: 8),
        Text(
          tx(
            'Press SOS for a 3-second countdown. Cancel anytime. A close pin goes to the campus desk.',
            'SOS চাপলে ৩ সেকেন্ড গুনতি। যেকোনো সময় বাতিল। কাছের পিন ক্যাম্পাস ডেস্কে যায়।',
          ),
          style: TextStyle(color: Colors.blueGrey.shade700, fontSize: 13, height: 1.35),
        ),
        if (alerts.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text(tx('Your SOS alerts', 'আপনার এসওএস'), style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          for (final alert in alerts.take(5)) _SosStatusTile(store: store, alert: alert),
        ],
      ],
    );
  }
}

class _SosStatusTile extends StatelessWidget {
  const _SosStatusTile({required this.store, required this.alert});

  final CampusStore store;
  final SosAlert alert;

  @override
  Widget build(BuildContext context) {
    final label = sosDeskStatusLabel(alert.deskStatus, store.tx);
    final color = switch (alert.deskStatus) {
      SosDeskStatus.solved => const Color(0xFF1B7A4E),
      SosDeskStatus.seen => const Color(0xFF163A66),
      SosDeskStatus.sent => const Color(0xFF5B6B7C),
    };
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFD5DEE8)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(fontWeight: FontWeight.w700, color: color)),
                const SizedBox(height: 4),
                Text(
                  alert.message,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: Colors.blueGrey.shade700, fontSize: 13),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Opens the cancelable SOS sheet. When [startInCountdown] is true (shake quick-exit),
/// skips straight to the 3-second countdown and never sends until that finishes.
Future<void> openSosFlow(BuildContext context, CampusStore store, {bool startInCountdown = false}) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    isDismissible: false,
    enableDrag: false,
    builder: (context) => SosFlowSheet(store: store, startInCountdown: startInCountdown),
  );
  await store.refreshSosAlerts();
}

class SosFlowSheet extends StatefulWidget {
  const SosFlowSheet({super.key, required this.store, this.startInCountdown = false});

  final CampusStore store;
  final bool startInCountdown;

  @override
  State<SosFlowSheet> createState() => _SosFlowSheetState();
}

enum _SosPhase { locating, count, sending, blocked, done }

class _SosFlowSheetState extends State<SosFlowSheet> {
  late _SosPhase _phase;
  LiveFix? _fix;
  bool _denied = false;
  bool _cancelled = false;
  StreamSubscription<Position>? _watch;
  Timer? _locateTimer;
  SosSendResult? _result;

  @override
  void initState() {
    super.initState();
    _phase = widget.startInCountdown ? _SosPhase.count : _SosPhase.locating;
    _startLocate();
  }

  @override
  void dispose() {
    _watch?.cancel();
    _locateTimer?.cancel();
    super.dispose();
  }

  Future<void> _startLocate() async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      if (!mounted) return;
      setState(() {
        _denied = true;
        _phase = _SosPhase.blocked;
      });
      return;
    }
    _locateTimer = Timer(Duration(milliseconds: _denied ? 8000 : 25000), () {
      if (!mounted || _cancelled) return;
      if (isPreciseFix(_fix)) return;
      // Do not interrupt an open countdown (shake quick-exit starts there).
      if (_phase == _SosPhase.count) return;
      setState(() => _phase = _SosPhase.blocked);
    });
    try {
      final current = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 10)),
      );
      _accept(current);
    } catch (_) {}
    _watch = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.best, distanceFilter: 0),
    ).listen(_accept, onError: (_) {
      if (!mounted) return;
      setState(() => _denied = true);
    });
  }

  void _accept(Position position) {
    if (_cancelled || !mounted) return;
    final next = LiveFix(
      lat: position.latitude,
      lng: position.longitude,
      accuracy: position.accuracy,
      at: position.timestamp,
    );
    final chosen = preferLiveFix(_fix, next);
    if (chosen == null) return;
    setState(() {
      _fix = chosen;
      if (_phase == _SosPhase.locating && isPreciseFix(chosen)) {
        _locateTimer?.cancel();
        _phase = _SosPhase.count;
      }
    });
  }

  void _cancel() {
    _cancelled = true;
    _watch?.cancel();
    _locateTimer?.cancel();
    if (mounted) Navigator.of(context).pop();
  }

  Future<void> _send(LiveFix? place) async {
    if (_cancelled) return;
    setState(() => _phase = _SosPhase.sending);
    final online = await _isOnline();
    if (!online) {
      if (_cancelled || !mounted) return;
      setState(() {
        _result = SosSendResult.offline();
        _phase = _SosPhase.done;
      });
      return;
    }
    final result = await widget.store.sendSos(place: place);
    if (_cancelled || !mounted) return;
    if (result.id != null && isPreciseFix(place)) {
      widget.store.startSosLiveShare(result.id!, place!);
    }
    setState(() {
      _result = result;
      _phase = _SosPhase.done;
    });
  }

  Future<bool> _isOnline() async {
    final results = await Connectivity().checkConnectivity();
    return results.any((item) => item != ConnectivityResult.none);
  }

  String _outcomeText() {
    final tx = widget.store.tx;
    final result = _result;
    if (result?.detail != null && result!.detail!.trim().isNotEmpty) {
      return result.detail!;
    }
    switch (result?.kind) {
      case SosSendKind.sent:
        return tx(
          'Help texts were sent with your location. The campus desk has the same alert.',
          'লোকেশনসহ সাহায্যের বার্তা পাঠানো হয়েছে। ক্যাম্পাস ডেস্কও একই সতর্কতা পেয়েছে।',
        );
      case SosSendKind.smsFailed:
        return tx(
          'The desk has the alert. One or more phone texts did not go through.',
          'ডেস্ক সতর্কতা পেয়েছে। এক বা একাধিক ফোন বার্তা যায়নি।',
        );
      case SosSendKind.soon:
        return tx('Wait a minute before sending another SOS.', 'আরেকটি SOS পাঠানোর আগে এক মিনিট অপেক্ষা করুন।');
      case SosSendKind.rejected:
        return tx('The alert was not saved. Try again in a moment.', 'সতর্কতা সেভ হয়নি। একটু পরে আবার চেষ্টা করুন।');
      case SosSendKind.offline:
        return tx('You are offline. The SOS was not sent.', 'আপনি অফলাইন। SOS পাঠানো হয়নি।');
      case SosSendKind.desk:
      case null:
        return tx(
          'The campus desk has the alert.',
          'ক্যাম্পাস ডেস্ক সতর্কতা পেয়েছে।',
        );
    }
  }

  Widget? _pin() {
    final fix = _fix;
    if (!isPreciseFix(fix)) return null;
    return LiveMap(
      bangla: widget.store.bangla,
      followDevice: false,
      fixedLat: fix!.lat,
      fixedLng: fix.lng,
      label: widget.store.tx('This pin will be sent', 'এই পিন যাবে'),
      height: 160,
      noteOverride: widget.store.tx(
        'Within ${fix.accuracy.round()} m of you',
        'আপনার ${fix.accuracy.round()} মিটারের মধ্যে',
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final tx = widget.store.tx;
    final pin = _pin();
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 16, 20, 16 + MediaQuery.viewInsetsOf(context).bottom),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(tx('SOS', 'এসওএস'), style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
              if (_phase == _SosPhase.locating) ...[
                Text(tx('Reading your live location…', 'আপনার লাইভ লোকেশন পড়া হচ্ছে…'), style: const TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                Text(
                  tx(
                    'The desk receives the pin only when it is close enough to find you. Allow location when the phone asks. A city-wide guess is not sent.',
                    'পিনটা আপনাকে খুঁজে পাওয়ার মতো কাছে এলেই ডেস্ক পায়। ফোন চাইলে লোকেশন অনুমতি দিন। শহরজুড়ে অনুমান পাঠানো হয় না।',
                  ),
                  style: TextStyle(color: Colors.blueGrey.shade700, height: 1.35),
                ),
                const SizedBox(height: 16),
                OutlinedButton(onPressed: _cancel, child: Text(tx('Cancel', 'বাতিল'))),
              ],
              if (_phase == _SosPhase.count)
                SosCountdown(
                  seconds: 3,
                  cancelLabel: tx('Cancel', 'বাতিল'),
                  onCancel: _cancel,
                  onComplete: () {
                    if (_cancelled) return;
                    final place = _fix;
                    if (!isPreciseFix(place)) {
                      setState(() => _phase = _SosPhase.blocked);
                      return;
                    }
                    _send(place);
                  },
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ?pin,
                      const SizedBox(height: 8),
                      Text(
                        tx(
                          'Cancel to stop. After this, the campus desk gets a help message with your live location. This does not call 999.',
                          'বাতিল করলে থেমে যাবে। এরপর ক্যাম্পাস ডেস্ক লাইভ লোকেশনসহ সাহায্যের বার্তা পায়। এতে ৯৯৯-এ কল হয় না।',
                        ),
                        style: TextStyle(color: Colors.blueGrey.shade700, height: 1.35),
                      ),
                    ],
                  ),
                ),
              if (_phase == _SosPhase.sending) ...[
                ?pin,
                const SizedBox(height: 12),
                Text(tx('Sending your help message…', 'সাহায্যের বার্তা পাঠানো হচ্ছে…')),
                const SizedBox(height: 12),
                const Center(child: CircularProgressIndicator()),
              ],
              if (_phase == _SosPhase.blocked) ...[
                Text(
                  tx(
                    'A close location did not arrive, so nothing was sent. Allow location for Safely, then press SOS again.',
                    'কাছের লোকেশন আসেনি, তাই কিছু পাঠানো হয়নি। Safely-এর লোকেশন অনুমতি দিন, তারপর আবার SOS চাপুন।',
                  ),
                  style: const TextStyle(height: 1.35),
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () => _send(null),
                  child: Text(tx('Alert the desk without a map', 'ম্যাপ ছাড়া ডেস্ককে জানান')),
                ),
                const SizedBox(height: 8),
                OutlinedButton(onPressed: _cancel, child: Text(tx('Cancel', 'বাতিল'))),
              ],
              if (_phase == _SosPhase.done) ...[
                Text(_outcomeText(), style: const TextStyle(height: 1.35)),
                if (_result?.kind == SosSendKind.offline) ...[
                  const SizedBox(height: 12),
                  Text(
                    tx(
                      'You can open the SMS app with a prefilled message to campus security. Safely does not send it for you — press Send yourself. This does not replace 999.',
                      'ক্যাম্পাস সিকিউরিটিতে প্রিফিল করা SMS অ্যাপ খুলতে পারেন। Safely নিজে পাঠায় না — আপনাকে Send চাপতে হবে। এটি ৯৯৯-এর বিকল্প নয়।',
                    ),
                    style: TextStyle(color: Colors.blueGrey.shade700, height: 1.35, fontSize: 13),
                  ),
                  const SizedBox(height: 12),
                  if (isUsableSecuritySmsNumber(widget.store.securitySmsNumber))
                    FilledButton.icon(
                      key: const Key('sos-offline-sms'),
                      onPressed: () {
                        final who = widget.store.member;
                        if (who == null) return;
                        unawaited(openOfflineSosSms(
                          name: who.name,
                          securityNumber: widget.store.securitySmsNumber,
                          place: _fix,
                        ));
                      },
                      icon: const Icon(Icons.sms_outlined),
                      label: Text(tx('Send SMS instead', 'বার্তায় পাঠান')),
                    )
                  else
                    Text(
                      tx(
                        'No campus security SMS number is saved yet. Call 999 if someone is in danger.',
                        'এখনও ক্যাম্পাস সিকিউরিটি SMS নম্বর সেভ নেই। কেউ বিপদে থাকলে ৯৯৯-এ কল করুন।',
                      ),
                      style: TextStyle(color: Colors.blueGrey.shade700, height: 1.35, fontSize: 13),
                    ),
                  const SizedBox(height: 8),
                  FilledButton.icon(
                    onPressed: dialEmergency999,
                    icon: const Icon(Icons.phone),
                    label: Text(tx('Call 999', '৯৯৯-এ কল')),
                  ),
                ],
                if (pin != null) ...[
                  const SizedBox(height: 12),
                  pin,
                ],
                const SizedBox(height: 12),
                FilledButton(onPressed: _cancel, child: Text(tx('Close', 'বন্ধ'))),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
