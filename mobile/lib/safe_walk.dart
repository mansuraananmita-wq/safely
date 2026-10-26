import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:safely_mobile/campus.dart';
import 'package:safely_mobile/sos.dart';

class EmergencyContact {
  const EmergencyContact({required this.id, required this.name, required this.phone});

  final String id;
  final String name;
  final String phone;

  factory EmergencyContact.fromRow(Map<String, dynamic> row) {
    return EmergencyContact(
      id: row['id'] as String? ?? '',
      name: row['name'] as String? ?? '',
      phone: row['phone'] as String? ?? '',
    );
  }
}

enum SafeWalkStatus { active, arrived, expired, cancelled }

SafeWalkStatus safeWalkStatusFrom(String raw) {
  switch (raw) {
    case 'arrived':
      return SafeWalkStatus.arrived;
    case 'expired':
      return SafeWalkStatus.expired;
    case 'cancelled':
      return SafeWalkStatus.cancelled;
    default:
      return SafeWalkStatus.active;
  }
}

class SafeWalk {
  SafeWalk({
    required this.id,
    required this.userId,
    required this.senderName,
    required this.destinationId,
    required this.destination,
    required this.startedAt,
    required this.endsAt,
    required this.status,
    required this.shareLocation,
    required this.notifyDesk,
    this.contactName = '',
    this.contactPhone = '',
    this.lastLat,
    this.lastLng,
    this.lastAccuracyM,
    this.closedAt,
  });

  final String id;
  final String userId;
  final String senderName;
  final String destinationId;
  final String destination;
  final DateTime startedAt;
  final DateTime endsAt;
  final SafeWalkStatus status;
  final bool shareLocation;
  final bool notifyDesk;
  final String contactName;
  final String contactPhone;
  final double? lastLat;
  final double? lastLng;
  final double? lastAccuracyM;
  final DateTime? closedAt;

  Duration get remaining {
    final left = endsAt.difference(DateTime.now());
    return left.isNegative ? Duration.zero : left;
  }

  factory SafeWalk.fromRow(Map<String, dynamic> row) {
    return SafeWalk(
      id: row['id'] as String? ?? '',
      userId: row['user_id'] as String? ?? '',
      senderName: row['sender_name'] as String? ?? '',
      destinationId: row['destination_id'] as String? ?? '',
      destination: row['destination'] as String? ?? '',
      startedAt: DateTime.tryParse(row['started_at'] as String? ?? '')?.toLocal() ?? DateTime.now(),
      endsAt: DateTime.tryParse(row['ends_at'] as String? ?? '')?.toLocal() ?? DateTime.now(),
      status: safeWalkStatusFrom(row['status'] as String? ?? 'active'),
      shareLocation: row['share_location'] as bool? ?? false,
      notifyDesk: row['notify_desk'] as bool? ?? true,
      contactName: row['contact_name'] as String? ?? '',
      contactPhone: row['contact_phone'] as String? ?? '',
      lastLat: (row['last_lat'] as num?)?.toDouble(),
      lastLng: (row['last_lng'] as num?)?.toDouble(),
      lastAccuracyM: (row['last_accuracy_m'] as num?)?.toDouble(),
      closedAt: DateTime.tryParse(row['closed_at'] as String? ?? '')?.toLocal(),
    );
  }
}

class SafeWalkScreen extends StatefulWidget {
  const SafeWalkScreen({super.key, required this.store});

  final CampusStore store;

  @override
  State<SafeWalkScreen> createState() => _SafeWalkScreenState();
}

class _SafeWalkScreenState extends State<SafeWalkScreen> {
  String _placeId = '';
  int _minutes = 15;
  bool _shareLocation = false;
  bool _notifyDesk = true;
  String? _contactId;
  String? _error;
  bool _busy = false;
  Timer? _tick;
  Timer? _locationTick;

  @override
  void initState() {
    super.initState();
    widget.store.refreshEmergencyContacts();
    widget.store.refreshSafeWalks();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) async {
      await widget.store.expireDueSafeWalks();
      if (mounted) setState(() {});
    });
    _locationTick = Timer.periodic(const Duration(seconds: 45), (_) {
      unawaited(_pushLocationIfNeeded());
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    _locationTick?.cancel();
    super.dispose();
  }

  Future<void> _pushLocationIfNeeded() async {
    final walk = widget.store.activeSafeWalk();
    if (walk == null || !walk.shareLocation) return;
    final permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) return;
    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.best, timeLimit: Duration(seconds: 12)),
      );
      final fix = LiveFix(lat: position.latitude, lng: position.longitude, accuracy: position.accuracy, at: DateTime.now());
      if (!isPreciseFix(fix)) return;
      await widget.store.updateSafeWalkLocation(walk.id, fix);
    } catch (_) {}
  }

  Future<void> _start() async {
    final store = widget.store;
    if (_placeId.isEmpty) {
      setState(() => _error = store.tx('Choose a destination.', 'গন্তব্য বেছে নিন।'));
      return;
    }
    if (!_notifyDesk && _contactId == null) {
      setState(() => _error = store.tx('Choose the campus desk and/or a saved contact.', 'ক্যাম্পাস ডেস্ক এবং/অথবা সেভ করা যোগাযোগ বেছে নিন।'));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    LiveFix? fix;
    if (_shareLocation) {
      final ok = await Geolocator.checkPermission().then((value) async {
        if (value == LocationPermission.denied) {
          return await Geolocator.requestPermission();
        }
        return value;
      });
      if (ok == LocationPermission.always || ok == LocationPermission.whileInUse) {
        try {
          final position = await Geolocator.getCurrentPosition(
            locationSettings: const LocationSettings(accuracy: LocationAccuracy.best, timeLimit: Duration(seconds: 12)),
          );
          fix = LiveFix(lat: position.latitude, lng: position.longitude, accuracy: position.accuracy, at: DateTime.now());
          if (!isPreciseFix(fix)) fix = null;
        } catch (_) {}
      }
    }
    EmergencyContact? contact;
    for (final item in store.emergencyContacts) {
      if (item.id == _contactId) {
        contact = item;
        break;
      }
    }
    final error = await store.startSafeWalk(
      destinationId: _placeId,
      minutes: _minutes,
      shareLocation: _shareLocation,
      notifyDesk: _notifyDesk,
      contactName: contact?.name ?? '',
      contactPhone: contact?.phone ?? '',
      place: fix,
    );
    if (!mounted) return;
    setState(() {
      _busy = false;
      _error = error;
    });
  }

  @override
  Widget build(BuildContext context) {
    final store = widget.store;
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        final tx = store.tx;
        final active = store.activeSafeWalk();
        return Scaffold(
          appBar: AppBar(title: Text(tx('Safe Walk', 'সেইফ ওয়াক'))),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
            children: [
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF1EC),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE7C4B8)),
                ),
                child: Text(
                  tx(
                    'Safe Walk does not replace 999. If someone is in danger, call 999.',
                    'সেইফ ওয়াক ৯৯৯-এর বিকল্প নয়। কেউ বিপদে থাকলে ৯৯৯-এ কল করুন।',
                  ),
                  style: const TextStyle(height: 1.4, fontWeight: FontWeight.w600),
                ),
              ),
              const SizedBox(height: 16),
              if (active != null) ...[
                Text(tx('Walk in progress', 'হাঁটা চলছে'), style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                Text(active.destination, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 18)),
                const SizedBox(height: 6),
                Text(
                  tx(
                    'Time left: ${_format(active.remaining)}',
                    'বাকি সময়: ${_format(active.remaining)}',
                  ),
                  style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w600),
                ),
                if (active.shareLocation)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(tx('Location sharing is on until you arrive or cancel.', 'আপনি পৌঁছানো বা বাতিল করা পর্যন্ত লোকেশন শেয়ার চালু।')),
                  ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _busy
                      ? null
                      : () async {
                          setState(() => _busy = true);
                          await store.finishSafeWalk(active.id, arrived: true);
                          if (mounted) setState(() => _busy = false);
                        },
                  child: Text(tx('I arrived', 'আমি পৌঁছেছি')),
                ),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: _busy
                      ? null
                      : () async {
                          setState(() => _busy = true);
                          await store.finishSafeWalk(active.id, arrived: false);
                          if (mounted) setState(() => _busy = false);
                        },
                  child: Text(tx('Cancel walk', 'হাঁটা বাতিল')),
                ),
              ] else ...[
                Text(tx('Start a Safe Walk', 'সেইফ ওয়াক শুরু'), style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                Text(tx('Pick a campus place and a timer. If the timer ends without “I arrived”, the campus desk can get an alert.', 'ক্যাম্পাসের একটি জায়গা ও টাইমার বেছে নিন। “আমি পৌঁছেছি” না চাপলে টাইমার শেষে ক্যাম্পাস ডেস্ক সতর্কতা পেতে পারে।')),
                const SizedBox(height: 12),
                Text(tx('Destination', 'গন্তব্য'), style: const TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final place in places)
                      ChoiceChip(
                        label: Text(store.bangla ? place.bn : place.en),
                        selected: _placeId == place.id,
                        onSelected: (_) => setState(() => _placeId = place.id),
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                Text(tx('Timer', 'টাইমার'), style: const TextStyle(fontWeight: FontWeight.w600)),
                Slider(
                  value: _minutes.toDouble(),
                  min: 5,
                  max: 60,
                  divisions: 11,
                  label: '$_minutes min',
                  onChanged: (value) => setState(() => _minutes = value.round()),
                ),
                Text(tx('$_minutes minutes', '$_minutes মিনিট')),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(tx('Share live location while walking', 'হাঁটার সময় লাইভ লোকেশন শেয়ার')),
                  subtitle: Text(tx('Stored only while sharing is on, then deleted 24 hours after the walk ends.', 'শেয়ার চালু থাকলেই রাখা হয়; হাঁটা শেষের ২৪ ঘণ্টা পর মুছে যায়।')),
                  value: _shareLocation,
                  onChanged: (value) => setState(() => _shareLocation = value),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(tx('Alert the campus desk if the timer ends', 'টাইমার শেষ হলে ক্যাম্পাস ডেস্ককে জানান')),
                  value: _notifyDesk,
                  onChanged: (value) => setState(() => _notifyDesk = value),
                ),
                if (store.emergencyContacts.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(tx('Trusted contact (optional)', 'বিশ্বস্ত যোগাযোগ (ঐচ্ছিক)'), style: const TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      ChoiceChip(
                        label: Text(tx('None', 'নেই')),
                        selected: _contactId == null,
                        onSelected: (_) => setState(() => _contactId = null),
                      ),
                      for (final contact in store.emergencyContacts)
                        ChoiceChip(
                          label: Text(contact.name),
                          selected: _contactId == contact.id,
                          onSelected: (_) => setState(() => _contactId = contact.id),
                        ),
                    ],
                  ),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  Text(_error!, style: const TextStyle(color: Color(0xFFB42318))),
                ],
                const SizedBox(height: 16),
                FilledButton(onPressed: _busy ? null : _start, child: Text(tx('Start Safe Walk', 'সেইফ ওয়াক শুরু'))),
              ],
            ],
          ),
        );
      },
    );
  }

  String _format(Duration value) {
    final minutes = value.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = value.inSeconds.remainder(60).toString().padLeft(2, '0');
    final hours = value.inHours;
    if (hours > 0) return '$hours:$minutes:$seconds';
    return '$minutes:$seconds';
  }
}
