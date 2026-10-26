import 'package:flutter/foundation.dart';
import 'package:safely_mobile/remote_config.dart';
import 'package:safely_mobile/safe_walk.dart';
import 'package:safely_mobile/sos.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class Member {
  const Member({required this.id, required this.name, required this.email, required this.unit, required this.role});

  final String id;
  final String name;
  final String email;
  final String unit;
  final String role;
}

class Place {
  const Place({required this.id, required this.en, required this.bn, required this.lat, required this.lng});

  final String id;
  final String en;
  final String bn;
  final double lat;
  final double lng;
}

class Report {
  Report({
    required this.id,
    required this.title,
    required this.description,
    required this.category,
    required this.locationId,
    required this.locationDetail,
    required this.lat,
    required this.lng,
    required this.status,
    required this.reporterId,
    required this.createdAt,
  });

  final String id;
  final String title;
  final String description;
  final String category;
  final String locationId;
  final String locationDetail;
  final double lat;
  final double lng;
  final String status;
  final String reporterId;
  final DateTime createdAt;
}

class SupportContact {
  const SupportContact({
    required this.id,
    required this.nameEn,
    required this.nameBn,
    required this.category,
    required this.phone,
    required this.email,
    required this.hours,
    required this.descriptionEn,
    required this.descriptionBn,
    required this.isActive,
    required this.sortOrder,
  });

  final String id;
  final String nameEn;
  final String nameBn;
  final String category;
  final String phone;
  final String email;
  final String hours;
  final String descriptionEn;
  final String descriptionBn;
  final bool isActive;
  final int sortOrder;

  factory SupportContact.fromRow(Map<String, dynamic> row) {
    return SupportContact(
      id: row['id'] as String? ?? '',
      nameEn: row['name_en'] as String? ?? '',
      nameBn: row['name_bn'] as String? ?? '',
      category: row['category'] as String? ?? 'other',
      phone: row['phone'] as String? ?? '',
      email: row['email'] as String? ?? '',
      hours: row['hours'] as String? ?? '',
      descriptionEn: row['description_en'] as String? ?? '',
      descriptionBn: row['description_bn'] as String? ?? '',
      isActive: row['is_active'] as bool? ?? true,
      sortOrder: (row['sort_order'] as num?)?.toInt() ?? 0,
    );
  }
}

String supportCategoryLabel(String category, bool bangla) {
  const labels = <String, (String, String)>{
    'emergency': ('Emergency', 'জরুরি'),
    'counseling': ('Counseling', 'কাউন্সেলিং'),
    'women_safety': ('Women safety', 'নারী নিরাপত্তা'),
    'legal': ('Legal', 'আইনি'),
    'health': ('Health', 'স্বাস্থ্য'),
    'proctor': ('Proctor', 'প্রক্টর'),
    'anti_harassment_committee': ('Anti-harassment', 'হয়রানি বিরোধী'),
  };
  final pair = labels[category];
  if (pair == null) return category;
  return bangla ? pair.$2 : pair.$1;
}

const seedSupportContacts = <SupportContact>[
  SupportContact(
    id: 'sc-emergency-999',
    nameEn: 'National emergency',
    nameBn: 'জাতীয় জরুরি সেবা',
    category: 'emergency',
    phone: '999',
    email: '',
    hours: '24 hours',
    descriptionEn: 'Call if someone is in danger. Safely is not an emergency service.',
    descriptionBn: 'কেউ বিপদে থাকলে কল করুন। সেইফলি জরুরি সেবা নয়।',
    isActive: true,
    sortOrder: 10,
  ),
  SupportContact(
    id: 'sc-counseling',
    nameEn: 'Student counseling',
    nameBn: 'শিক্ষার্থী কাউন্সেলিং',
    category: 'counseling',
    phone: '01XXXXXXXXX',
    email: 'counseling@campus.example',
    hours: 'Sun–Thu 9:00–17:00',
    descriptionEn: 'Placeholder, replace with real campus number.',
    descriptionBn: 'Placeholder, replace with real campus number.',
    isActive: true,
    sortOrder: 20,
  ),
  SupportContact(
    id: 'sc-women-safety',
    nameEn: 'Women safety desk',
    nameBn: 'নারী নিরাপত্তা ডেস্ক',
    category: 'women_safety',
    phone: '01XXXXXXXXX',
    email: 'womensafety@campus.example',
    hours: 'Sun–Thu 9:00–17:00',
    descriptionEn: 'Placeholder, replace with real campus number.',
    descriptionBn: 'Placeholder, replace with real campus number.',
    isActive: true,
    sortOrder: 30,
  ),
  SupportContact(
    id: 'sc-legal',
    nameEn: 'Legal aid desk',
    nameBn: 'আইনি সহায়তা ডেস্ক',
    category: 'legal',
    phone: '01XXXXXXXXX',
    email: 'legal@campus.example',
    hours: 'Sun–Thu 9:00–17:00',
    descriptionEn: 'Placeholder, replace with real campus number.',
    descriptionBn: 'Placeholder, replace with real campus number.',
    isActive: true,
    sortOrder: 40,
  ),
  SupportContact(
    id: 'sc-health',
    nameEn: 'Campus medical center',
    nameBn: 'ক্যাম্পাস মেডিকেল সেন্টার',
    category: 'health',
    phone: '01XXXXXXXXX',
    email: 'medical@campus.example',
    hours: '24 hours',
    descriptionEn: 'Placeholder, replace with real campus number.',
    descriptionBn: 'Placeholder, replace with real campus number.',
    isActive: true,
    sortOrder: 50,
  ),
  SupportContact(
    id: 'sc-proctor',
    nameEn: 'Proctor office',
    nameBn: 'প্রক্টর অফিস',
    category: 'proctor',
    phone: '01XXXXXXXXX',
    email: 'proctor@campus.example',
    hours: 'Sun–Thu 9:00–17:00',
    descriptionEn: 'Placeholder, replace with real campus number.',
    descriptionBn: 'Placeholder, replace with real campus number.',
    isActive: true,
    sortOrder: 60,
  ),
  SupportContact(
    id: 'sc-anti-harassment',
    nameEn: 'Anti-harassment committee',
    nameBn: 'হয়রানি বিরোধী কমিটি',
    category: 'anti_harassment_committee',
    phone: '01XXXXXXXXX',
    email: 'ahc@campus.example',
    hours: 'Sun–Thu 9:00–17:00',
    descriptionEn: 'Placeholder, replace with real campus number.',
    descriptionBn: 'Placeholder, replace with real campus number.',
    isActive: true,
    sortOrder: 70,
  ),
];

const members = <Member>[
  Member(id: 'u-amina', name: 'Amina Rahman', email: 'amina@padma.edu', unit: 'Computer Science', role: 'Student'),
  Member(id: 'u-karim', name: 'Dr. Karim Hassan', email: 'karim@padma.edu', unit: 'Physics', role: 'Teacher'),
  Member(id: 'u-nusrat', name: 'Nusrat Jahan', email: 'nusrat@padma.edu', unit: 'Registry', role: 'Staff'),
];

const places = <Place>[
  Place(id: 'gate', en: 'Main Gate', bn: 'প্রধান ফটক', lat: 23.7251, lng: 90.38158),
  Place(id: 'bus', en: 'Bus Stand', bn: 'বাস স্ট্যান্ড', lat: 23.7349, lng: 90.37906),
  Place(id: 'medical', en: 'Medical Center', bn: 'মেডিকেল সেন্টার', lat: 23.7419, lng: 90.38746),
  Place(id: 'admin', en: 'Admin Building', bn: 'প্রশাসন ভবন', lat: 23.7342, lng: 90.3883),
  Place(id: 'library', en: 'Library', bn: 'গ্রন্থাগার', lat: 23.7398, lng: 90.3967),
  Place(id: 'science', en: 'Science Block', bn: 'বিজ্ঞান ভবন', lat: 23.7405, lng: 90.40678),
  Place(id: 'cafe', en: 'Cafeteria', bn: 'ক্যাফেটেরিয়া', lat: 23.73, lng: 90.39502),
  Place(id: 'arts', en: 'Arts Faculty', bn: 'কলা অনুষদ', lat: 23.7307, lng: 90.40342),
  Place(id: 'eng', en: 'Engineering Lab', bn: 'প্রকৌশল ল্যাব', lat: 23.7328, lng: 90.41098),
  Place(id: 'dorm', en: 'Dormitory A', bn: 'আবাসিক হল এ', lat: 23.7202, lng: 90.3883),
  Place(id: 'field', en: 'Sports Field', bn: 'খেলার মাঠ', lat: 23.7209, lng: 90.40678),
];

const categories = <(String, String, String)>[
  ('infrastructure', 'Infrastructure & Road Damage', 'অবকাঠামো ও সড়ক ক্ষতি'),
  ('lighting', 'Lighting & Electricity', 'আলো ও বিদ্যুৎ'),
  ('water', 'Water Supply & Sanitation', 'পানি সরবরাহ ও স্যানিটেশন'),
  ('cleanliness', 'Cleanliness & Waste', 'পরিচ্ছন্নতা ও বর্জ্য'),
  ('safety', 'Campus Safety', 'ক্যাম্পাস নিরাপত্তা'),
  ('classroom', 'Classroom & Laboratory', 'শ্রেণিকক্ষ ও গবেষণাগার'),
  ('internet', 'Internet & Technology', 'ইন্টারনেট ও প্রযুক্তি'),
  ('accessibility', 'Accessibility', 'প্রবেশগম্যতা'),
  ('other', 'Other', 'অন্যান্য'),
];

Place? placeById(String id) {
  for (final place in places) {
    if (place.id == id) return place;
  }
  return null;
}

String categoryName(String id, bool bangla) {
  for (final category in categories) {
    if (category.$1 == id) return bangla ? category.$3 : category.$2;
  }
  return id;
}

class CampusStore extends ChangeNotifier {
  CampusStore() {
    _reports.addAll(_seed());
    _supportContacts.addAll(seedSupportContacts);
  }

  Member? member;
  bool bangla = false;
  String? error;
  final List<Report> _reports = [];
  final List<SosAlert> _sosAlerts = [];
  final List<SupportContact> _supportContacts = [];
  final List<SafeWalk> _safeWalks = [];
  final List<EmergencyContact> _emergencyContacts = [];
  int _next = 10530;
  int _walkNext = 1;

  bool get remote => remoteReady && Supabase.instance.isInitialized;

  List<Report> get reports => List.unmodifiable(_reports);

  List<SupportContact> activeSupportContacts() {
    final items = _supportContacts.where((item) => item.isActive).toList()
      ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder) != 0 ? a.sortOrder.compareTo(b.sortOrder) : a.id.compareTo(b.id));
    return items;
  }

  List<SosAlert> mySosAlerts() {
    final id = member?.id;
    if (id == null) return const [];
    final mine = _sosAlerts.where((alert) => alert.userId == id).toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return mine;
  }

  List<EmergencyContact> get emergencyContacts => List.unmodifiable(_emergencyContacts);

  List<SafeWalk> mySafeWalks() {
    final id = member?.id;
    if (id == null) return const [];
    final mine = _safeWalks.where((walk) => walk.userId == id).toList()
      ..sort((a, b) => b.startedAt.compareTo(a.startedAt));
    return mine;
  }

  SafeWalk? activeSafeWalk() {
    for (final walk in mySafeWalks()) {
      if (walk.status == SafeWalkStatus.active) return walk;
    }
    return null;
  }

  List<Report> mine() {
    final id = member?.id;
    if (id == null) return const [];
    return _reports.where((report) => report.reporterId == id).toList();
  }

  Future<void> login(Member next) async {
    error = null;
    if (!remote) {
      member = next;
      notifyListeners();
      return;
    }
    try {
      final auth = await Supabase.instance.client.auth.signInWithPassword(
        email: next.email,
        password: 'padma1234',
      );
      if (auth.user == null) {
        error = 'Sign-in did not start.';
        notifyListeners();
        return;
      }
      await refresh();
    } catch (caught) {
      error = caught.toString();
      notifyListeners();
    }
  }

  Future<void> logout() async {
    member = null;
    error = null;
    _sosAlerts.clear();
    _safeWalks.clear();
    _emergencyContacts.clear();
    if (remote) {
      await Supabase.instance.client.auth.signOut();
      _reports
        ..clear()
        ..addAll(_seed());
      _supportContacts
        ..clear()
        ..addAll(seedSupportContacts);
    }
    notifyListeners();
  }

  void toggleLanguage() {
    bangla = !bangla;
    notifyListeners();
  }

  String tx(String en, String bn) => bangla ? bn : en;

  Report? find(String id) {
    for (final report in _reports) {
      if (report.id == id) return report;
    }
    return null;
  }

  Future<Report?> submit({
    required String title,
    required String description,
    required String category,
    required String locationId,
    required String locationDetail,
    required double lat,
    required double lng,
    List<Map<String, String>> photos = const [],
    bool anonymous = false,
  }) async {
    final who = member;
    if (who == null) return null;
    final limitedPhotos = photos.take(3).toList();
    final confidential = anonymous || category == 'harassment';
    if (!remote) {
      final report = Report(
        id: 'SF-$_next',
        title: title.trim(),
        description: description.trim(),
        category: category,
        locationId: locationId,
        locationDetail: locationDetail.trim(),
        lat: lat,
        lng: lng,
        status: 'submitted',
        reporterId: who.id,
        createdAt: DateTime.now(),
      );
      _next += 1;
      _reports.insert(0, report);
      notifyListeners();
      return report;
    }
    try {
      final client = Supabase.instance.client;
      final issued = await client.rpc('next_report_id');
      final id = issued is String ? issued : 'SF-${DateTime.now().millisecondsSinceEpoch}';
      final now = DateTime.now().toUtc();
      final due = now.add(Duration(hours: _sla(category)));
      await client.from('reports').insert({
        'id': id,
        'title': title.trim(),
        'description': description.trim(),
        'category': category,
        'location_id': locationId,
        'location_detail': locationDetail.trim(),
        'lat': lat,
        'lng': lng,
        'status': 'submitted',
        'priority': category == 'safety' || category == 'harassment' ? 'high' : 'medium',
        'reporter_id': anonymous ? null : who.id,
        'created_at': now.toIso8601String(),
        'updated_at': now.toIso8601String(),
        'due_at': due.toIso8601String(),
        'confidential': confidential,
        'anonymous': anonymous,
        'photos': limitedPhotos,
        'info_requested': false,
        'blocks_access': false,
        'contact_window': '',
      });
      try {
        await client.from('report_activities').insert({
          'id': 'a${now.microsecondsSinceEpoch}',
          'report_id': id,
          'at': now.toIso8601String(),
          'actor': who.name,
          'visibility': 'public',
          'kind': 'system',
          'message': 'Submitted from the phone app.',
        });
        final admins = await client.from('profiles').select('id').eq('role', 'admin');
        if (admins.isNotEmpty) {
          await client.from('notifications').insert([
            for (final row in admins)
              {
                'id': 'n${now.microsecondsSinceEpoch}${row['id']}',
                'user_id': row['id'],
                'title': 'New report from the phone app',
                'body': '$id is with the campus desk.',
                'href': '/admin/reports/$id',
                'read': false,
                'created_at': now.toIso8601String(),
                'kind': 'received',
              },
          ]);
        }
      } catch (_) {}
      final report = Report(
        id: id,
        title: title.trim(),
        description: description.trim(),
        category: category,
        locationId: locationId,
        locationDetail: locationDetail.trim(),
        lat: lat,
        lng: lng,
        status: 'submitted',
        reporterId: who.id,
        createdAt: now.toLocal(),
      );
      _reports.insert(0, report);
      error = null;
      notifyListeners();
      return report;
    } catch (caught) {
      error = caught.toString();
      notifyListeners();
      return null;
    }
  }

  Future<void> refresh() async {
    final client = Supabase.instance.client;
    final email = client.auth.currentUser?.email;
    if (email == null) return;
    final profile = await client.from('profiles').select().eq('email', email).maybeSingle();
    if (profile == null) return;
    member = Member(
      id: profile['id'] as String,
      name: profile['name'] as String? ?? '',
      email: profile['email'] as String? ?? email,
      unit: profile['unit'] as String? ?? '',
      role: profile['role'] as String? ?? '',
    );
    final rows = await client.from('reports').select().eq('reporter_id', member!.id).order('created_at', ascending: false);
    _reports
      ..clear()
      ..addAll([
        for (final row in rows as List)
          Report(
            id: row['id'] as String,
            title: row['title'] as String? ?? '',
            description: row['description'] as String? ?? '',
            category: row['category'] as String? ?? 'other',
            locationId: row['location_id'] as String? ?? '',
            locationDetail: row['location_detail'] as String? ?? '',
            lat: (row['lat'] as num?)?.toDouble() ?? 0,
            lng: (row['lng'] as num?)?.toDouble() ?? 0,
            status: row['status'] as String? ?? 'submitted',
            reporterId: row['reporter_id'] as String? ?? member!.id,
            createdAt: DateTime.tryParse(row['created_at'] as String? ?? '')?.toLocal() ?? DateTime.now(),
          ),
      ]);
    await refreshSosAlerts();
    await refreshSupportContacts();
    await refreshEmergencyContacts();
    await refreshSafeWalks();
    notifyListeners();
  }

  Future<void> refreshEmergencyContacts() async {
    final who = member;
    if (who == null) return;
    if (!remote) {
      notifyListeners();
      return;
    }
    try {
      final rows = await Supabase.instance.client.from('emergency_contacts').select().eq('user_id', who.id).order('created_at');
      _emergencyContacts
        ..clear()
        ..addAll([for (final row in rows as List) EmergencyContact.fromRow(Map<String, dynamic>.from(row as Map))]);
      notifyListeners();
    } catch (_) {}
  }

  Future<void> refreshSafeWalks() async {
    final who = member;
    if (who == null) return;
    if (!remote) {
      notifyListeners();
      return;
    }
    try {
      await expireDueSafeWalks();
      await Supabase.instance.client.rpc('cleanup_safe_walk_locations');
      final rows = await Supabase.instance.client.from('safe_walks').select().eq('user_id', who.id).order('started_at', ascending: false).limit(20);
      _safeWalks
        ..clear()
        ..addAll([for (final row in rows as List) SafeWalk.fromRow(Map<String, dynamic>.from(row as Map))]);
      notifyListeners();
    } catch (_) {}
  }

  Future<void> expireDueSafeWalks() async {
    if (!remote) {
      final now = DateTime.now();
      var changed = false;
      for (var i = 0; i < _safeWalks.length; i++) {
        final walk = _safeWalks[i];
        if (walk.status == SafeWalkStatus.active && !walk.endsAt.isAfter(now)) {
          _safeWalks[i] = SafeWalk(
            id: walk.id,
            userId: walk.userId,
            senderName: walk.senderName,
            destinationId: walk.destinationId,
            destination: walk.destination,
            startedAt: walk.startedAt,
            endsAt: walk.endsAt,
            status: SafeWalkStatus.expired,
            shareLocation: walk.shareLocation,
            notifyDesk: walk.notifyDesk,
            contactName: walk.contactName,
            contactPhone: walk.contactPhone,
            lastLat: walk.lastLat,
            lastLng: walk.lastLng,
            lastAccuracyM: walk.lastAccuracyM,
            closedAt: now,
          );
          changed = true;
        }
      }
      if (changed) notifyListeners();
      return;
    }
    try {
      await Supabase.instance.client.rpc('expire_due_safe_walks');
    } catch (_) {}
  }

  Future<String?> startSafeWalk({
    required String destinationId,
    required int minutes,
    required bool shareLocation,
    required bool notifyDesk,
    String contactName = '',
    String contactPhone = '',
    LiveFix? place,
  }) async {
    final who = member;
    final campus = placeById(destinationId);
    if (who == null || campus == null) return 'Not signed in';
    if (minutes < 5 || minutes > 60) return 'Choose 5 to 60 minutes.';
    if (!notifyDesk && contactName.trim().isEmpty) return 'Choose the campus desk and/or a saved contact.';
    if (activeSafeWalk() != null) return 'Finish the open Safe Walk first.';
    final started = DateTime.now().toUtc();
    final ends = started.add(Duration(minutes: minutes));
    final id = 'sw${started.millisecondsSinceEpoch}$_walkNext';
    _walkNext += 1;
    final destination = bangla ? campus.bn : campus.en;
    final walk = SafeWalk(
      id: id,
      userId: who.id,
      senderName: who.name,
      destinationId: destinationId,
      destination: destination,
      startedAt: started.toLocal(),
      endsAt: ends.toLocal(),
      status: SafeWalkStatus.active,
      shareLocation: shareLocation,
      notifyDesk: notifyDesk,
      contactName: contactName,
      contactPhone: contactPhone,
      lastLat: shareLocation && isPreciseFix(place) ? place!.lat : null,
      lastLng: shareLocation && isPreciseFix(place) ? place!.lng : null,
      lastAccuracyM: shareLocation && isPreciseFix(place) ? place!.accuracy : null,
    );
    if (!remote) {
      _safeWalks.insert(0, walk);
      notifyListeners();
      return null;
    }
    try {
      await Supabase.instance.client.from('safe_walks').insert({
        'id': id,
        'user_id': who.id,
        'sender_name': who.name,
        'destination_id': destinationId,
        'destination': destination,
        'started_at': started.toIso8601String(),
        'ends_at': ends.toIso8601String(),
        'status': 'active',
        'share_location': shareLocation,
        'notify_desk': notifyDesk,
        'contact_name': contactName,
        'contact_phone': contactPhone,
        'last_lat': walk.lastLat,
        'last_lng': walk.lastLng,
        'last_accuracy_m': walk.lastAccuracyM,
        'location_updated_at': walk.lastLat == null ? null : started.toIso8601String(),
      });
      await refreshSafeWalks();
      return null;
    } catch (caught) {
      return caught.toString();
    }
  }

  Future<String?> finishSafeWalk(String id, {required bool arrived}) async {
    final who = member;
    if (who == null) return 'Not signed in';
    if (!remote) {
      final index = _safeWalks.indexWhere((item) => item.id == id && item.userId == who.id);
      if (index < 0) return 'Safe Walk not found.';
      final walk = _safeWalks[index];
      _safeWalks[index] = SafeWalk(
        id: walk.id,
        userId: walk.userId,
        senderName: walk.senderName,
        destinationId: walk.destinationId,
        destination: walk.destination,
        startedAt: walk.startedAt,
        endsAt: walk.endsAt,
        status: arrived ? SafeWalkStatus.arrived : SafeWalkStatus.cancelled,
        shareLocation: walk.shareLocation,
        notifyDesk: walk.notifyDesk,
        contactName: walk.contactName,
        contactPhone: walk.contactPhone,
        lastLat: walk.lastLat,
        lastLng: walk.lastLng,
        lastAccuracyM: walk.lastAccuracyM,
        closedAt: DateTime.now(),
      );
      notifyListeners();
      return null;
    }
    try {
      await Supabase.instance.client.from('safe_walks').update({
        'status': arrived ? 'arrived' : 'cancelled',
      }).eq('id', id).eq('user_id', who.id);
      await refreshSafeWalks();
      return null;
    } catch (caught) {
      return caught.toString();
    }
  }

  Future<void> updateSafeWalkLocation(String id, LiveFix place) async {
    final who = member;
    if (who == null || !remote || !isPreciseFix(place)) return;
    try {
      await Supabase.instance.client.from('safe_walks').update({
        'last_lat': place.lat,
        'last_lng': place.lng,
        'last_accuracy_m': place.accuracy,
        'location_updated_at': DateTime.now().toUtc().toIso8601String(),
      }).eq('id', id).eq('user_id', who.id).eq('status', 'active');
    } catch (_) {}
  }

  Future<void> refreshSupportContacts() async {
    if (!remote) {
      if (_supportContacts.isEmpty) {
        _supportContacts.addAll(seedSupportContacts);
      }
      notifyListeners();
      return;
    }
    try {
      final rows = await Supabase.instance.client
          .from('support_contacts')
          .select()
          .eq('is_active', true)
          .order('sort_order', ascending: true);
      _supportContacts
        ..clear()
        ..addAll([for (final row in rows as List) SupportContact.fromRow(Map<String, dynamic>.from(row as Map))]);
      if (_supportContacts.isEmpty) {
        _supportContacts.addAll(seedSupportContacts);
      }
      notifyListeners();
    } catch (_) {
      if (_supportContacts.isEmpty) {
        _supportContacts.addAll(seedSupportContacts);
        notifyListeners();
      }
    }
  }

  Future<void> refreshSosAlerts() async {
    final who = member;
    if (who == null) return;
    if (!remote) {
      notifyListeners();
      return;
    }
    try {
      final rows = await Supabase.instance.client
          .from('sos_alerts')
          .select()
          .eq('user_id', who.id)
          .order('created_at', ascending: false)
          .limit(20);
      _sosAlerts
        ..clear()
        ..addAll([for (final row in rows as List) SosAlert.fromRow(Map<String, dynamic>.from(row as Map))]);
      notifyListeners();
    } catch (_) {}
  }

  Future<SosSendResult> sendSos({LiveFix? place}) async {
    final who = member;
    if (who == null) {
      return const SosSendResult(kind: SosSendKind.rejected, detail: 'Not signed in');
    }
    final latest = mySosAlerts().isEmpty ? null : mySosAlerts().first;
    if (latest != null && DateTime.now().difference(latest.createdAt) < const Duration(seconds: 60)) {
      return const SosSendResult(kind: SosSendKind.soon, detail: 'Wait a minute before sending another SOS');
    }
    final id = newSosId();
    final message = sosMessage(who.name, isPreciseFix(place) ? place : null);
    final createdAt = DateTime.now().toUtc();
    final alert = SosAlert(
      id: id,
      userId: who.id,
      senderName: who.name,
      lat: isPreciseFix(place) ? place!.lat : null,
      lng: isPreciseFix(place) ? place!.lng : null,
      accuracyM: isPreciseFix(place) ? place!.accuracy : null,
      message: message,
      createdAt: createdAt.toLocal(),
    );

    if (!remote) {
      _sosAlerts.insert(0, alert);
      notifyListeners();
      return SosSendResult(kind: SosSendKind.desk, id: id);
    }

    try {
      final client = Supabase.instance.client;
      await client.from('sos_alerts').insert({
        'id': id,
        'user_id': who.id,
        'sender_name': who.name,
        'lat': alert.lat,
        'lng': alert.lng,
        'accuracy_m': alert.accuracyM,
        'message': message,
        'contacts': <Map<String, String>>[],
        'sms_status': 'pending',
        'sms_detail': '',
        'created_at': createdAt.toIso8601String(),
      });
      _sosAlerts.insert(0, alert);
      notifyListeners();

      var kind = SosSendKind.desk;
      String? detail;
      try {
        final response = await client.functions.invoke('send-sos', body: {'alertId': id});
        final data = response.data;
        final status = data is Map ? data['status']?.toString() : null;
        final payloadDetail = data is Map ? data['detail']?.toString() : null;
        if (status == 'sent') {
          kind = SosSendKind.sent;
        } else if (status == 'failed' || status == 'partial') {
          kind = SosSendKind.smsFailed;
          detail = payloadDetail;
        } else if (status == 'skipped') {
          kind = SosSendKind.desk;
          detail = payloadDetail;
        }
        if (status != null) {
          await client.from('sos_alerts').update({
            'sms_status': status,
            'sms_detail': (payloadDetail ?? '').length > 180 ? payloadDetail!.substring(0, 180) : (payloadDetail ?? ''),
          }).eq('id', id);
        }
      } catch (_) {
        kind = SosSendKind.desk;
      }
      await refreshSosAlerts();
      return SosSendResult(kind: kind, id: id, detail: detail);
    } on PostgrestException catch (caught) {
      final detail = caught.message.trim();
      if (RegExp(r'wait a minute', caseSensitive: false).hasMatch(detail)) {
        return SosSendResult(kind: SosSendKind.soon, detail: detail);
      }
      return SosSendResult(kind: SosSendKind.rejected, detail: detail.isEmpty ? null : detail);
    } catch (caught) {
      final detail = caught.toString();
      if (RegExp(r'wait a minute', caseSensitive: false).hasMatch(detail)) {
        return SosSendResult(kind: SosSendKind.soon, detail: detail);
      }
      if (RegExp(r'socket|offline|failed host|network', caseSensitive: false).hasMatch(detail)) {
        return SosSendResult.offline();
      }
      return SosSendResult(kind: SosSendKind.rejected, detail: detail);
    }
  }

  int _sla(String category) {
    switch (category) {
      case 'safety':
        return 12;
      case 'cleanliness':
        return 36;
      case 'lighting':
      case 'water':
      case 'classroom':
        return 48;
      default:
        return 72;
    }
  }

  static List<Report> _seed() {
    final now = DateTime.now();
    return [
      Report(
        id: 'SF-10482',
        title: 'Broken asphalt at the main gate crossing',
        description: 'The west footpath drops away. People are stepping into the road.',
        category: 'infrastructure',
        locationId: 'gate',
        locationDetail: 'West footpath',
        lat: 23.7251,
        lng: 90.38158,
        status: 'in_progress',
        reporterId: 'u-amina',
        createdAt: now.subtract(const Duration(hours: 30)),
      ),
      Report(
        id: 'SF-10510',
        title: 'Library wifi drops every few minutes',
        description: 'Padma-WiFi on the first floor disconnects at the quiet tables.',
        category: 'internet',
        locationId: 'library',
        locationDetail: 'First floor, north windows',
        lat: 23.7398,
        lng: 90.3967,
        status: 'submitted',
        reporterId: 'u-amina',
        createdAt: now.subtract(const Duration(hours: 6)),
      ),
      Report(
        id: 'SF-10490',
        title: 'Streetlight out along the Arts Faculty path',
        description: 'Two lamps on the west path have been dark for three nights.',
        category: 'lighting',
        locationId: 'arts',
        locationDetail: 'West path',
        lat: 23.7307,
        lng: 90.40342,
        status: 'assigned',
        reporterId: 'u-karim',
        createdAt: now.subtract(const Duration(hours: 18)),
      ),
    ];
  }
}
