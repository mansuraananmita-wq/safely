import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:webview_flutter/webview_flutter.dart';

class LiveMap extends StatefulWidget {
  const LiveMap({
    super.key,
    required this.bangla,
    this.followDevice = true,
    this.fixedLat,
    this.fixedLng,
    this.label,
  });

  final bool bangla;
  final bool followDevice;
  final double? fixedLat;
  final double? fixedLng;
  final String? label;

  @override
  State<LiveMap> createState() => _LiveMapState();
}

class _LiveMapState extends State<LiveMap> {
  WebViewController? _controller;
  StreamSubscription<Position>? _stream;
  String _loaded = '';
  String _status = 'seeking';
  double _lat = 23.7342;
  double _lng = 90.392;

  @override
  void initState() {
    super.initState();
    try {
      _controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(const Color(0xFFF4F6F8));
    } catch (_) {
      _controller = null;
    }
    if (widget.fixedLat != null && widget.fixedLng != null) {
      _lat = widget.fixedLat!;
      _lng = widget.fixedLng!;
      _status = 'pin';
    }
    _show(_lat, _lng);
    if (widget.followDevice && widget.fixedLat == null) _listen();
  }

  @override
  void didUpdateWidget(LiveMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.fixedLat != null && widget.fixedLng != null && (widget.fixedLat != oldWidget.fixedLat || widget.fixedLng != oldWidget.fixedLng)) {
      _lat = widget.fixedLat!;
      _lng = widget.fixedLng!;
      _status = 'pin';
      _show(_lat, _lng);
    }
    if (widget.bangla != oldWidget.bangla) _show(_lat, _lng, force: true);
  }

  Future<void> _listen() async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    final allowed = permission == LocationPermission.always || permission == LocationPermission.whileInUse;
    if (!allowed || !mounted) {
      setState(() => _status = 'off');
      _show(_lat, _lng);
      return;
    }
    _stream = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 15),
    ).listen((position) {
      if (!mounted) return;
      setState(() {
        _lat = position.latitude;
        _lng = position.longitude;
        _status = 'live';
      });
      _show(_lat, _lng);
    }, onError: (_) {
      if (!mounted) return;
      setState(() => _status = 'off');
      _show(_lat, _lng);
    });
  }

  void _show(double lat, double lng, {bool force = false}) {
    final key = '${lat.toStringAsFixed(4)},${lng.toStringAsFixed(4)},${widget.bangla}';
    if (!force && key == _loaded) return;
    _loaded = key;
    final hl = widget.bangla ? 'bn' : 'en';
    _controller?.loadRequest(Uri.parse('https://maps.google.com/maps?q=$lat,$lng&z=16&hl=$hl&output=embed'));
  }

  @override
  void dispose() {
    _stream?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final live = _status == 'live';
    final title = widget.label ?? (live ? (widget.bangla ? 'আপনি এখানে' : 'You are here') : (widget.bangla ? 'ক্যাম্পাস' : 'Campus'));
    final note = switch (_status) {
      'live' => widget.bangla ? 'এই পিন আপনার লাইভ লোকেশন অনুসরণ করে।' : 'This pin follows your live location.',
      'seeking' => widget.bangla ? 'আপনার লোকেশন খোঁজা হচ্ছে…' : 'Finding your location…',
      'pin' => widget.bangla ? 'গুগল ম্যাপে এই রিপোর্টের পিন।' : 'This report’s pin on Google Maps.',
      _ => widget.bangla ? 'লোকেশন বন্ধ। অনুমতি দিলে পিন আপনার কাছে আসবে।' : 'Location is off. Allow it and the pin moves to you.',
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text(note, style: TextStyle(color: Colors.blueGrey.shade700, fontSize: 12)),
                ],
              ),
            ),
            if (_status == 'off')
              TextButton(
                onPressed: _listen,
                child: Text(widget.bangla ? 'আবার' : 'Retry'),
              ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: SizedBox(
            height: 240,
            child: _controller == null
                ? ColoredBox(
                    color: Colors.white,
                    child: Center(child: Text('${_lat.toStringAsFixed(5)}, ${_lng.toStringAsFixed(5)}')),
                  )
                : WebViewWidget(controller: _controller!),
          ),
        ),
      ],
    );
  }
}
