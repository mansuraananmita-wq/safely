import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:safely_mobile/campus.dart';
import 'package:safely_mobile/live_map.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(SafelyApp(store: CampusStore()));
}

class SafelyApp extends StatelessWidget {
  const SafelyApp({super.key, required this.store});

  final CampusStore store;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        return MaterialApp(
          debugShowCheckedModeBanner: false,
          title: 'Safely',
          theme: ThemeData(
            useMaterial3: true,
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF163A66),
              onPrimary: Colors.white,
              secondary: Color(0xFF1E4E89),
              onSecondary: Colors.white,
              surface: Colors.white,
              onSurface: Color(0xFF152033),
              error: Color(0xFFB42318),
              onError: Colors.white,
            ),
            scaffoldBackgroundColor: const Color(0xFFF4F6F8),
            appBarTheme: const AppBarTheme(
              backgroundColor: Color(0xFFF4F6F8),
              foregroundColor: Color(0xFF152033),
              elevation: 0,
              centerTitle: false,
            ),
            inputDecorationTheme: InputDecorationTheme(
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFD5DEE8))),
            ),
            filledButtonTheme: FilledButtonThemeData(
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF163A66),
                foregroundColor: Colors.white,
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              ),
            ),
          ),
          home: store.member == null ? LoginScreen(store: store) : HomeShell(store: store),
        );
      },
    );
  }
}

class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key, required this.store});

  final CampusStore store;

  @override
  Widget build(BuildContext context) {
    final tx = store.tx;
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
          children: [
            Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: const Color(0xFF163A66), borderRadius: BorderRadius.circular(10)),
              child: const Icon(Icons.check, color: Colors.white),
            ),
            const SizedBox(height: 20),
            Text('Safely', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Text(
              tx('Padma University phone app for students, teachers, and staff. The operations desk stays on the website.', 'পদ্মা বিশ্ববিদ্যালয়ের ফোন অ্যাপ, শিক্ষার্থী, শিক্ষক ও কর্মকর্তাদের জন্য। অপারেশন ডেস্ক ওয়েবসাইটে থাকে।'),
              style: TextStyle(color: Colors.blueGrey.shade700, height: 1.4),
            ),
            const SizedBox(height: 24),
            Text(tx('Demo accounts', 'ডেমো অ্যাকাউন্ট'), style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            for (final member in members)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Material(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  child: ListTile(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: const BorderSide(color: Color(0xFFD5DEE8)),
                    ),
                    title: Text(member.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text('${member.email}\n${member.role} · ${member.unit}'),
                    isThreeLine: true,
                    onTap: () => store.login(member),
                  ),
                ),
              ),
            const SizedBox(height: 8),
            Text(
              tx('This is not an emergency service. If someone is in danger, call 999.', 'এটি জরুরি সেবা নয়। কেউ বিপদে থাকলে ৯৯৯-এ কল করুন।'),
              style: TextStyle(color: Colors.blueGrey.shade600, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}

class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.store});

  final CampusStore store;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final store = widget.store;
    final tx = store.tx;
    final pages = [
      MemberHome(store: store, onReport: () => setState(() => _index = 2)),
      ReportList(store: store),
      NewReport(store: store, onDone: (id) {
        setState(() => _index = 1);
        Navigator.of(context).push(MaterialPageRoute(builder: (_) => ReportDetail(store: store, id: id)));
      }),
      AlertsPage(store: store),
    ];
    return Scaffold(
      appBar: AppBar(
        title: const Text('Safely'),
        actions: [
          TextButton(onPressed: store.toggleLanguage, child: Text(store.bangla ? 'EN' : 'বাংলা')),
          IconButton(onPressed: store.logout, icon: const Icon(Icons.logout), tooltip: tx('Sign out', 'সাইন আউট')),
        ],
      ),
      body: pages[_index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: [
          NavigationDestination(icon: const Icon(Icons.home_outlined), selectedIcon: const Icon(Icons.home), label: tx('Home', 'হোম')),
          NavigationDestination(icon: const Icon(Icons.list_alt_outlined), selectedIcon: const Icon(Icons.list_alt), label: tx('Reports', 'রিপোর্ট')),
          NavigationDestination(icon: const Icon(Icons.add_circle_outline), selectedIcon: const Icon(Icons.add_circle), label: tx('New', 'নতুন')),
          NavigationDestination(icon: const Icon(Icons.campaign_outlined), selectedIcon: const Icon(Icons.campaign), label: tx('Alerts', 'সতর্কতা')),
        ],
      ),
    );
  }
}

class MemberHome extends StatelessWidget {
  const MemberHome({super.key, required this.store, required this.onReport});

  final CampusStore store;
  final VoidCallback onReport;

  @override
  Widget build(BuildContext context) {
    final member = store.member!;
    final tx = store.tx;
    final open = store.mine().where((report) => report.status != 'closed').toList();
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      children: [
        Text(member.name, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600)),
        Text(member.unit, style: TextStyle(color: Colors.blueGrey.shade700)),
        const SizedBox(height: 16),
        Text(tx('Your location', 'আপনার লোকেশন'), style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        LiveMap(bangla: store.bangla),
        const SizedBox(height: 16),
        FilledButton(onPressed: onReport, child: Text(tx('Report a problem', 'সমস্যা জানান'))),
        const SizedBox(height: 20),
        Text(tx('Your reports', 'আপনার রিপোর্ট'), style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        if (open.isEmpty)
          Text(tx('Nothing open yet.', 'এখন খোলা কিছু নেই।'))
        else
          for (final report in open) ReportTile(store: store, report: report),
      ],
    );
  }
}

class ReportList extends StatelessWidget {
  const ReportList({super.key, required this.store});

  final CampusStore store;

  @override
  Widget build(BuildContext context) {
    final items = store.mine();
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      children: [
        Text(store.tx('My reports', 'আমার রিপোর্ট'), style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 12),
        if (items.isEmpty) Text(store.tx('You have not filed a report in this app yet.', 'এই অ্যাপে আপনি এখনও রিপোর্ট দেননি।')) else
          for (final report in items) ReportTile(store: store, report: report),
      ],
    );
  }
}

class ReportTile extends StatelessWidget {
  const ReportTile({super.key, required this.store, required this.report});

  final CampusStore store;
  final Report report;

  @override
  Widget build(BuildContext context) {
    final place = placeById(report.locationId);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        child: ListTile(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: Color(0xFFD5DEE8))),
          title: Text(report.title, style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text('${report.id} · ${place == null ? '' : (store.bangla ? place.bn : place.en)}'),
          trailing: Text(report.status, style: const TextStyle(fontSize: 12, color: Color(0xFF163A66))),
          onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ReportDetail(store: store, id: report.id))),
        ),
      ),
    );
  }
}

class ReportDetail extends StatelessWidget {
  const ReportDetail({super.key, required this.store, required this.id});

  final CampusStore store;
  final String id;

  @override
  Widget build(BuildContext context) {
    final report = store.find(id);
    if (report == null) {
      return Scaffold(appBar: AppBar(), body: Center(child: Text(store.tx('That report is not on this account.', 'এই অ্যাকাউন্টে রিপোর্টটি নেই।'))));
    }
    final place = placeById(report.locationId);
    return Scaffold(
      appBar: AppBar(title: Text(report.id)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        children: [
          Text(report.title, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Text('${categoryName(report.category, store.bangla)} · ${place == null ? '' : (store.bangla ? place.bn : place.en)} · ${report.locationDetail}'),
          const SizedBox(height: 12),
          Text(report.description, style: const TextStyle(height: 1.4)),
          const SizedBox(height: 16),
          LiveMap(bangla: store.bangla, followDevice: false, fixedLat: report.lat, fixedLng: report.lng, label: place == null ? report.id : (store.bangla ? place.bn : place.en)),
        ],
      ),
    );
  }
}

class NewReport extends StatefulWidget {
  const NewReport({super.key, required this.store, required this.onDone});

  final CampusStore store;
  final ValueChanged<String> onDone;

  @override
  State<NewReport> createState() => _NewReportState();
}

class _NewReportState extends State<NewReport> {
  String _category = 'lighting';
  String _placeId = '';
  final _title = TextEditingController();
  final _body = TextEditingController();
  final _detail = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    _detail.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final store = widget.store;
    if (_title.text.trim().length < 8 || _body.text.trim().length < 20 || _placeId.isEmpty) {
      setState(() => _error = store.tx('Add a title, a description, and a place.', 'শিরোনাম, বিবরণ, এবং স্থান দিন।'));
      return;
    }
    final place = placeById(_placeId)!;
    var lat = place.lat;
    var lng = place.lng;
    final permission = await GeolocatorPermission.ask();
    if (permission) {
      try {
        final position = await Geolocator.getCurrentPosition();
        lat = position.latitude;
        lng = position.longitude;
      } catch (_) {}
    }
    final report = store.submit(
      title: _title.text,
      description: _body.text,
      category: _category,
      locationId: _placeId,
      locationDetail: _detail.text,
      lat: lat,
      lng: lng,
    );
    widget.onDone(report.id);
  }

  @override
  Widget build(BuildContext context) {
    final store = widget.store;
    final tx = store.tx;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      children: [
        Text(tx('New report', 'নতুন রিপোর্ট'), style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        Text(tx('The pin uses your live location when the phone allows it. Otherwise it stays on the building you choose.', 'ফোন অনুমতি দিলে পিন আপনার লাইভ লোকেশনে যায়। না হলে আপনার বেছে নেওয়া ভবনে থাকে।')),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final category in categories)
              ChoiceChip(
                label: Text(store.bangla ? category.$3 : category.$2),
                selected: _category == category.$1,
                onSelected: (_) => setState(() => _category = category.$1),
              ),
          ],
        ),
        const SizedBox(height: 12),
        TextField(controller: _title, decoration: InputDecoration(labelText: tx('Title', 'শিরোনাম'))),
        const SizedBox(height: 12),
        TextField(controller: _body, minLines: 4, maxLines: 6, decoration: InputDecoration(labelText: tx('What happened', 'কী হয়েছে'))),
        const SizedBox(height: 12),
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
        const SizedBox(height: 12),
        TextField(controller: _detail, decoration: InputDecoration(labelText: tx('Where exactly', 'ঠিক কোথায়'))),
        if (_error != null) ...[
          const SizedBox(height: 8),
          Text(_error!, style: const TextStyle(color: Color(0xFFB42318))),
        ],
        const SizedBox(height: 16),
        FilledButton(onPressed: () => _submit(), child: Text(tx('Submit report', 'রিপোর্ট জমা দিন'))),
      ],
    );
  }
}

class GeolocatorPermission {
  static Future<bool> ask() async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.always || permission == LocationPermission.whileInUse;
  }
}

class AlertsPage extends StatelessWidget {
  const AlertsPage({super.key, required this.store});

  final CampusStore store;

  @override
  Widget build(BuildContext context) {
    final tx = store.tx;
    final items = [
      (tx('Dormitory A tank cleaning', 'আবাসিক হল এ ট্যাংক পরিষ্কার'), tx('Water may run low from 10pm Friday to 2am Saturday. A dry tap outside that window still needs a report.', 'শুক্রবার রাত ১০টা থেকে শনিবার ভোর ২টা পর্যন্ত পানি কমতে পারে। এই সময়ের বাইরে কল শুকনো থাকলে রিপোর্ট দিন।')),
      (tx('Extra patrol at the sports field', 'খেলার মাঠে অতিরিক্ত পাহারা'), tx('Security walks the east path after evening practice while the lamps are repaired.', 'বাতি মেরামত না হওয়া পর্যন্ত সন্ধ্যায় অনুশীলনের পর নিরাপত্তা পূর্ব পাশ দিয়ে যায়।')),
    ];
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      children: [
        Text(tx('Campus alerts', 'ক্যাম্পাস সতর্কতা'), style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 12),
        for (final item in items)
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: const Color(0xFFFFF6E8), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE7D3A8))),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(item.$1, style: const TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 6),
              Text(item.$2, style: const TextStyle(height: 1.4)),
            ]),
          ),
      ],
    );
  }
}
