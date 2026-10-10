import 'package:flutter/foundation.dart';

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
  }

  Member? member;
  bool bangla = false;
  final List<Report> _reports = [];
  int _next = 10530;

  List<Report> get reports => List.unmodifiable(_reports);

  List<Report> mine() {
    final id = member?.id;
    if (id == null) return const [];
    return _reports.where((report) => report.reporterId == id).toList();
  }

  void login(Member next) {
    member = next;
    notifyListeners();
  }

  void logout() {
    member = null;
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

  Report submit({
    required String title,
    required String description,
    required String category,
    required String locationId,
    required String locationDetail,
    required double lat,
    required double lng,
  }) {
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
      reporterId: member!.id,
      createdAt: DateTime.now(),
    );
    _next += 1;
    _reports.insert(0, report);
    notifyListeners();
    return report;
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
