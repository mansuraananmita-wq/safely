import 'dart:async';

import 'package:flutter/material.dart';
import 'package:safely_mobile/campus.dart';
import 'package:safely_mobile/quick_exit_prefs.dart';

class FakeCallScreen extends StatefulWidget {
  const FakeCallScreen({super.key, required this.store, required this.prefs});

  final CampusStore store;
  final QuickExitPrefs prefs;

  @override
  State<FakeCallScreen> createState() => _FakeCallScreenState();
}

class _FakeCallScreenState extends State<FakeCallScreen> {
  late final TextEditingController _name;
  late int _delay;
  Timer? _timer;
  int _left = 0;
  bool _armed = false;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.prefs.fakeCallerName);
    _delay = widget.prefs.fakeCallDelaySec;
  }

  @override
  void dispose() {
    _timer?.cancel();
    _name.dispose();
    super.dispose();
  }

  void _arm() {
    final name = _name.text.trim().isEmpty ? 'Mom' : _name.text.trim();
    unawaited(widget.prefs.setFakeCallerName(name));
    unawaited(widget.prefs.setFakeCallDelaySec(_delay));
    setState(() {
      _armed = true;
      _left = _delay;
    });
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      if (_left <= 1) {
        timer.cancel();
        setState(() {
          _armed = false;
          _left = 0;
        });
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => IncomingFakeCallScreen(callerName: name, bangla: widget.store.bangla),
          ),
        );
        return;
      }
      setState(() => _left -= 1);
    });
  }

  void _cancelArm() {
    _timer?.cancel();
    setState(() {
      _armed = false;
      _left = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    final tx = widget.store.tx;
    return Scaffold(
      appBar: AppBar(title: Text(tx('Fake Call', 'নকল কল'))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        children: [
          Text(
            tx(
              'After the delay, Safely shows a fake incoming call so you can step away. This does not place a real phone call and does not replace 999.',
              'ডিলে শেষে Safely একটি নকল ইনকামিং কল দেখায় যাতে আপনি সরে যেতে পারেন। এতে আসল কল হয় না এবং ৯৯৯-এর বিকল্প নয়।',
            ),
            style: TextStyle(color: Colors.blueGrey.shade700, height: 1.4),
          ),
          const SizedBox(height: 16),
          Text(tx('Caller name', 'কলারের নাম'), style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          TextField(
            controller: _name,
            decoration: InputDecoration(hintText: tx('Mom', 'মা')),
            enabled: !_armed,
          ),
          const SizedBox(height: 16),
          Text(tx('Ring after', 'কতক্ষণ পর'), style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              for (final seconds in const [5, 15, 30])
                ChoiceChip(
                  label: Text(tx('$seconds seconds', '$seconds সেকেন্ড')),
                  selected: _delay == seconds,
                  onSelected: _armed ? null : (_) => setState(() => _delay = seconds),
                ),
            ],
          ),
          const SizedBox(height: 24),
          if (_armed) ...[
            Text(
              tx('Incoming call in $_left…', 'ইনকামিং কল $_left…'),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: _cancelArm, child: Text(tx('Cancel', 'বাতিল'))),
          ] else
            FilledButton(onPressed: _arm, child: Text(tx('Start Fake Call', 'নকল কল শুরু'))),
        ],
      ),
    );
  }
}

class IncomingFakeCallScreen extends StatefulWidget {
  const IncomingFakeCallScreen({super.key, required this.callerName, required this.bangla});

  final String callerName;
  final bool bangla;

  @override
  State<IncomingFakeCallScreen> createState() => _IncomingFakeCallScreenState();
}

class _IncomingFakeCallScreenState extends State<IncomingFakeCallScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;
  bool _accepted = false;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  String _tx(String en, String bn) => widget.bangla ? bn : en;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B1220),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 48, 24, 32),
          child: Column(
            children: [
              Text(
                _accepted ? _tx('Connected', 'সংযুক্ত') : _tx('Incoming call', 'ইনকামিং কল'),
                style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 16, letterSpacing: 0.4),
              ),
              const SizedBox(height: 28),
              ScaleTransition(
                scale: Tween(begin: 0.94, end: 1.06).animate(CurvedAnimation(parent: _pulse, curve: Curves.easeInOut)),
                child: CircleAvatar(
                  radius: 56,
                  backgroundColor: const Color(0xFF1E4E89),
                  child: Text(
                    widget.callerName.isEmpty ? '?' : widget.callerName.substring(0, 1).toUpperCase(),
                    style: const TextStyle(color: Colors.white, fontSize: 44, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                widget.callerName,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 8),
              Text(
                _accepted ? _tx('Mobile · Safely', 'মোবাইল · Safely') : _tx('Mobile', 'মোবাইল'),
                style: TextStyle(color: Colors.white.withValues(alpha: 0.55)),
              ),
              const Spacer(),
              if (_accepted)
                _RoundAction(
                  color: const Color(0xFFB42318),
                  icon: Icons.call_end,
                  label: _tx('End', 'শেষ'),
                  onPressed: () => Navigator.of(context).pop(),
                )
              else
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _RoundAction(
                      color: const Color(0xFFB42318),
                      icon: Icons.call_end,
                      label: _tx('Decline', 'কাটুন'),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                    _RoundAction(
                      color: const Color(0xFF1B7A4E),
                      icon: Icons.call,
                      label: _tx('Accept', 'নিন'),
                      onPressed: () {
                        _pulse.stop();
                        setState(() => _accepted = true);
                      },
                    ),
                  ],
                ),
              const SizedBox(height: 16),
              Text(
                _tx('Fake call · does not dial 999', 'নকল কল · ৯৯৯ ডায়াল করে না'),
                style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RoundAction extends StatelessWidget {
  const _RoundAction({
    required this.color,
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  final Color color;
  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Material(
          color: color,
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onPressed,
            child: SizedBox(
              width: 72,
              height: 72,
              child: Icon(icon, color: Colors.white, size: 32),
            ),
          ),
        ),
        const SizedBox(height: 10),
        Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
      ],
    );
  }
}
