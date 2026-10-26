import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:safely_mobile/campus.dart';
import 'package:safely_mobile/device_push.dart';
import 'package:safely_mobile/fake_call.dart';
import 'package:safely_mobile/help.dart';
import 'package:safely_mobile/live_map.dart';
import 'package:safely_mobile/quick_exit_prefs.dart';
import 'package:safely_mobile/quick_exit_settings.dart';
import 'package:safely_mobile/remote_config.dart';
import 'package:safely_mobile/report_clips.dart';
import 'package:safely_mobile/safe_walk.dart';
import 'package:safely_mobile/shake_sos.dart';
import 'package:safely_mobile/sos_panel.dart';
import 'package:safely_mobile/strip_image_meta.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (remoteReady) {
    await Supabase.initialize(url: supabaseUrl, publishableKey: supabaseAnonKey);
  }
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
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Image.asset('assets/safely-logo.png', width: 88, height: 88, fit: BoxFit.cover),
            ),
            const SizedBox(height: 16),
            Text('Safely', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Text(
              tx(
                remoteReady
                    ? 'Padma University phone app. A report saved here also appears on the campus website.'
                    : 'Padma University phone app for students, teachers, and staff. Start it with the campus script so reports reach the website.',
                remoteReady
                    ? 'পদ্মা বিশ্ববিদ্যালয়ের ফোন অ্যাপ। এখানে সেভ করা রিপোর্ট ক্যাম্পাস ওয়েবসাইটেও দেখা যায়।'
                    : 'পদ্মা বিশ্ববিদ্যালয়ের ফোন অ্যাপ, শিক্ষার্থী, শিক্ষক ও কর্মকর্তাদের জন্য। ওয়েবসাইটে পৌঁছাতে ক্যাম্পাস স্ক্রিপ্ট দিয়ে চালু করুন।',
              ),
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
                    onTap: () {
                      store.login(member);
                    },
                  ),
                ),
              ),
            if (store.error != null) ...[
              const SizedBox(height: 8),
              Text(store.error!, style: const TextStyle(color: Color(0xFFB42318))),
            ],
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
  final QuickExitPrefs _quickExit = QuickExitPrefs();

  @override
  void initState() {
    super.initState();
    _quickExit.load();
    unawaited(registerDevicePush(widget.store));
  }

  @override
  Widget build(BuildContext context) {
    final store = widget.store;
    final tx = store.tx;
    return ListenableBuilder(
      listenable: _quickExit,
      builder: (context, _) {
        final pages = [
          MemberHome(
            store: store,
            prefs: _quickExit,
            onReport: () => setState(() => _index = 2),
          ),
          ReportList(store: store),
          NewReport(store: store, onDone: (id) {
            setState(() => _index = 1);
            Navigator.of(context).push(MaterialPageRoute(builder: (_) => ReportDetail(store: store, id: id)));
          }),
          AlertsPage(store: store),
        ];
        return ShakeToSosListener(
          enabled: _quickExit.shakeToSos,
          onStartCountdown: () => openSosFlow(context, store, startInCountdown: true),
          child: Scaffold(
            appBar: AppBar(
              title: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.asset('assets/safely-logo.png', width: 28, height: 28, fit: BoxFit.cover),
                  ),
                  const SizedBox(width: 10),
                  const Text('Safely'),
                ],
              ),
              actions: [
                IconButton(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => QuickExitSettingsScreen(store: store, prefs: _quickExit)),
                    );
                  },
                  icon: const Icon(Icons.settings_outlined),
                  tooltip: tx('Quick exit', 'দ্রুত বেরোনো'),
                ),
                TextButton(onPressed: store.toggleLanguage, child: Text(store.bangla ? 'EN' : 'বাংলা')),
                IconButton(onPressed: () { store.logout(); }, icon: const Icon(Icons.logout), tooltip: tx('Sign out', 'সাইন আউট')),
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
          ),
        );
      },
    );
  }
}

class MemberHome extends StatelessWidget {
  const MemberHome({super.key, required this.store, required this.prefs, required this.onReport});

  final CampusStore store;
  final QuickExitPrefs prefs;
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
        SosHomeSection(store: store),
        const SizedBox(height: 20),
        Text(tx('Your location', 'আপনার লোকেশন'), style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        LiveMap(bangla: store.bangla),
        const SizedBox(height: 16),
        FilledButton(onPressed: onReport, child: Text(tx('Report a problem', 'সমস্যা জানান'))),
        const SizedBox(height: 10),
        OutlinedButton(
          onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => SafeWalkScreen(store: store))),
          child: Text(tx('Safe Walk', 'সেইফ ওয়াক')),
        ),
        if (prefs.fakeCallShortcut) ...[
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => FakeCallScreen(store: store, prefs: prefs))),
            child: Text(tx('Fake Call', 'নকল কল')),
          ),
        ],
        const SizedBox(height: 10),
        OutlinedButton(
          onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => HelpScreen(store: store))),
          child: Text(tx('Get help', 'সাহায্য নিন')),
        ),
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
          if (report.voicePath != null) ...[
            const SizedBox(height: 16),
            ReportClipPlayer(label: store.tx('Voice note', 'ভয়েস নোট'), storagePath: report.voicePath),
          ],
          if (report.videoPath != null) ...[
            const SizedBox(height: 16),
            ReportClipPlayer(label: store.tx('Video', 'ভিডিও'), storagePath: report.videoPath),
          ],
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
  final List<Map<String, String>> _photos = [];
  bool _anonymous = false;
  bool _busy = false;
  String? _error;
  ReportClip? _voice;
  ReportClip? _video;
  final VoiceRecorder _recorder = VoiceRecorder();
  bool _recording = false;

  @override
  void dispose() {
    _recorder.dispose();
    _title.dispose();
    _body.dispose();
    _detail.dispose();
    super.dispose();
  }

  Future<void> _toggleVoice() async {
    final store = widget.store;
    try {
      if (_recording) {
        final clip = await _recorder.stop();
        setState(() {
          _recording = false;
          _voice = clip;
          _error = null;
        });
        return;
      }
      final problem = await _recorder.start();
      if (problem != null) {
        setState(() => _error = store.tx(problem, 'মাইক্রোফোনের অনুমতি লাগবে।'));
        return;
      }
      setState(() => _recording = true);
    } catch (error) {
      setState(() => _error = error.toString());
    }
  }

  Future<void> _addVideo() async {
    try {
      final clip = await pickReportVideo();
      if (clip == null) return;
      setState(() {
        _video = clip;
        _error = null;
      });
    } catch (error) {
      setState(() => _error = error.toString());
    }
  }

  Future<void> _addPhoto() async {
    final store = widget.store;
    if (_photos.length >= 3) return;
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 100);
    if (picked == null) return;
    try {
      final bytes = await picked.readAsBytes();
      if (bytes.lengthInBytes > 5 * 1024 * 1024) {
        setState(() => _error = store.tx('Each photo must be under 5 MB.', 'প্রতিটি ছবি ৫ এমবির কম হতে হবে।'));
        return;
      }
      final mime = picked.mimeType ?? 'image/jpeg';
      final payload = strippedPhotoPayload(bytes, fileName: picked.name, mime: mime);
      setState(() {
        _photos.add(payload);
        _error = null;
      });
    } catch (_) {
      setState(() => _error = store.tx('That photo could not be prepared. Try another file.', 'ছবি প্রস্তুত করা যায়নি। অন্য ফাইল চেষ্টা করুন।'));
    }
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
    setState(() => _busy = true);
    final report = await store.submit(
      title: _title.text,
      description: _body.text,
      category: _category,
      locationId: _placeId,
      locationDetail: _detail.text,
      lat: lat,
      lng: lng,
      photos: List<Map<String, String>>.from(_photos),
      anonymous: _anonymous,
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (report == null) {
      setState(() => _error = store.error ?? store.tx('The report was not saved.', 'রিপোর্ট সেভ হয়নি।'));
      return;
    }
    try {
      if (_voice != null) await uploadReportClip(store, report.id, _voice!, video: false);
      if (_video != null) await uploadReportClip(store, report.id, _video!, video: true);
      if (store.remote) await store.refresh();
    } catch (error) {
      setState(() => _error = store.tx('The report was saved, but a recording was not stored.', 'রিপোর্ট সেভ হয়েছে, কিন্তু রেকর্ডিং সেভ হয়নি।'));
    }
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
        Text(tx('The pin uses your live location when the phone allows it. Otherwise it stays on the building you choose. Photo GPS is removed before upload.', 'ফোন অনুমতি দিলে পিন আপনার লাইভ লোকেশনে যায়। না হলে আপনার বেছে নেওয়া ভবনে থাকে। ছবির GPS আপলোডের আগে সরানো হয়।')),
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
        const SizedBox(height: 12),
        Text(tx('Photos (optional, up to 3)', 'ছবি (ঐচ্ছিক, সর্বোচ্চ ৩টি)'), style: const TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (var i = 0; i < _photos.length; i++)
              InputChip(
                label: Text(_photos[i]['name'] ?? 'photo'),
                onDeleted: () => setState(() => _photos.removeAt(i)),
              ),
            if (_photos.length < 3)
              OutlinedButton.icon(
                onPressed: _busy ? null : _addPhoto,
                icon: const Icon(Icons.photo_outlined),
                label: Text(tx('Add photo', 'ছবি যোগ')),
              ),
          ],
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: _busy ? null : _toggleVoice,
          icon: Icon(_recording ? Icons.stop : Icons.mic_none),
          label: Text(_recording ? tx('Stop voice note', 'ভয়েস নোট থামান') : tx('Record voice note (60s)', 'ভয়েস নোট রেকর্ড (৬০ সে.)')),
        ),
        if (_voice != null) Text(tx('Voice note ready · ${_voice!.seconds}s', 'ভয়েস নোট প্রস্তুত · ${_voice!.seconds} সে.')),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: _busy ? null : _addVideo,
          icon: const Icon(Icons.videocam_outlined),
          label: Text(tx('Add short video (30s, 20 MB)', 'ছোট ভিডিও যোগ (৩০ সে., ২০ এমবি)')),
        ),
        if (_video != null) Text(tx('Video ready · ${_video!.seconds}s', 'ভিডিও প্রস্তুত · ${_video!.seconds} সে.')),
        const SizedBox(height: 12),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          value: _anonymous,
          onChanged: _busy ? null : (value) => setState(() => _anonymous = value ?? false),
          title: Text(tx('Anonymous', 'বেনামি')),
          controlAffinity: ListTileControlAffinity.leading,
        ),
        if (_anonymous)
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF1EC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE7C4B8)),
            ),
            child: Text(
              tx(
                'Photos, a voice note, or a video can still identify you. Faces, uniforms, and the sound of a voice may reveal who filed the report even when your name is hidden.',
                'ছবি, ভয়েস নোট, বা ভিডিও থেকেও পরিচয় ফাঁস হতে পারে। মুখ, ইউনিফর্ম, এবং কণ্ঠস্বর নাম লুকানো থাকলেও রিপোর্টকারীকে চেনা দিতে পারে।',
              ),
              style: const TextStyle(height: 1.35),
            ),
          ),
        if (_error != null) ...[
          const SizedBox(height: 8),
          Text(_error!, style: const TextStyle(color: Color(0xFFB42318))),
        ],
        const SizedBox(height: 16),
        FilledButton(onPressed: _busy ? null : () => _submit(), child: Text(tx('Submit report', 'রিপোর্ট জমা দিন'))),
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
