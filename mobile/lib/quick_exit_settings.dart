import 'package:flutter/material.dart';
import 'package:safely_mobile/campus.dart';
import 'package:safely_mobile/fake_call.dart';
import 'package:safely_mobile/quick_exit_prefs.dart';

class QuickExitSettingsScreen extends StatelessWidget {
  const QuickExitSettingsScreen({super.key, required this.store, required this.prefs});

  final CampusStore store;
  final QuickExitPrefs prefs;

  @override
  Widget build(BuildContext context) {
    final tx = store.tx;
    return ListenableBuilder(
      listenable: prefs,
      builder: (context, _) {
        return Scaffold(
          appBar: AppBar(title: Text(tx('Quick exit', 'দ্রুত বেরোনো'))),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
            children: [
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF8E8),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE7D4A8)),
                ),
                child: Text(
                  tx(
                    'Accidental triggers: a bump in a bag or pocket can shake the phone. Leave shake-to-SOS off unless you need it. If a countdown starts by mistake, tap Cancel — nothing is sent until those 3 seconds finish. Fake Call never places a real call and does not replace 999.',
                    'ভুল ট্রিগার: ব্যাগ বা পকেটে ঝাঁকুনিতে ফোন কেঁপে যেতে পারে। দরকার না হলে শেক-টু-SOS বন্ধ রাখুন। ভুলে গুনতি শুরু হলে Cancel চাপুন — ৩ সেকেন্ড শেষ না হওয়া পর্যন্ত কিছু পাঠানো হয় না। নকল কল আসল কল করে না এবং ৯৯৯-এর বিকল্প নয়।',
                  ),
                  style: const TextStyle(height: 1.4, fontWeight: FontWeight.w600),
                ),
              ),
              const SizedBox(height: 16),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(tx('Shake to start SOS countdown', 'ঝাঁকিয়ে SOS গুনতি শুরু')),
                subtitle: Text(
                  tx(
                    'Off by default. Starts only the cancelable 3-second countdown — never sends instantly.',
                    'ডিফল্ট বন্ধ। শুধু বাতিলযোগ্য ৩ সেকেন্ড গুনতি শুরু করে — তৎক্ষণাৎ পাঠায় না।',
                  ),
                ),
                value: prefs.shakeToSos,
                onChanged: (value) => prefs.setShakeToSos(value),
              ),
              const Divider(height: 28),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(tx('Show Fake Call on Home', 'হোমে নকল কল দেখান')),
                subtitle: Text(
                  tx(
                    'Adds a Fake Call button so you can schedule a fake incoming call after 5, 15, or 30 seconds.',
                    'হোমে নকল কল বাটন যোগ করে — ৫, ১৫ বা ৩০ সেকেন্ড পর নকল ইনকামিং কল।',
                  ),
                ),
                value: prefs.fakeCallShortcut,
                onChanged: (value) => prefs.setFakeCallShortcut(value),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => FakeCallScreen(store: store, prefs: prefs)),
                  );
                },
                child: Text(tx('Open Fake Call', 'নকল কল খুলুন')),
              ),
            ],
          ),
        );
      },
    );
  }
}
