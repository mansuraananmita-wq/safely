import 'package:flutter/material.dart';
import 'package:safely_mobile/campus.dart';
import 'package:url_launcher/url_launcher.dart';

Future<void> dialPhone(String phone) async {
  final digits = phone.replaceAll(RegExp(r'[^\d+]'), '');
  if (digits.isEmpty) return;
  await launchUrl(Uri(scheme: 'tel', path: digits));
}

class HelpScreen extends StatefulWidget {
  const HelpScreen({super.key, required this.store});

  final CampusStore store;

  @override
  State<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends State<HelpScreen> {
  @override
  void initState() {
    super.initState();
    widget.store.refreshSupportContacts();
  }

  @override
  Widget build(BuildContext context) {
    final store = widget.store;
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        final tx = store.tx;
        final contacts = store.activeSupportContacts();
        return Scaffold(
          appBar: AppBar(title: Text(tx('Get help', 'সাহায্য নিন'))),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
            children: [
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF6E8),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE7D3A8)),
                ),
                child: Text(
                  tx(
                    'If you can, call 999. The SOS button messages the campus desk with your location. It does not call 999.',
                    'পারলে ৯৯৯-এ কল করুন। SOS বোতাম লোকেশনসহ ক্যাম্পাস ডেস্কে বার্তা পাঠায়। এতে ৯৯৯-এ কল হয় না।',
                  ),
                  style: const TextStyle(height: 1.4),
                ),
              ),
              const SizedBox(height: 16),
              for (final item in contacts)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Material(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () => dialPhone(item.phone),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFD5DEE8)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              supportCategoryLabel(item.category, store.bangla),
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF163A66)),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              store.bangla ? item.nameBn : item.nameEn,
                              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                            ),
                            if ((store.bangla ? item.descriptionBn : item.descriptionEn).isNotEmpty) ...[
                              const SizedBox(height: 6),
                              Text(
                                store.bangla ? item.descriptionBn : item.descriptionEn,
                                style: TextStyle(color: Colors.blueGrey.shade700, height: 1.35),
                              ),
                            ],
                            const SizedBox(height: 10),
                            Text(
                              item.phone,
                              style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w600, color: Color(0xFF152033)),
                            ),
                            if (item.hours.isNotEmpty || item.email.isNotEmpty) ...[
                              const SizedBox(height: 6),
                              Text(
                                [if (item.hours.isNotEmpty) item.hours, if (item.email.isNotEmpty) item.email].join(' · '),
                                style: TextStyle(fontSize: 12, color: Colors.blueGrey.shade600),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
