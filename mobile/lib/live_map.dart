import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:safely_mobile/sos.dart';
import 'package:webview_flutter/webview_flutter.dart';

class LiveMap extends StatefulWidget {
  const LiveMap({
    super.key,
    required this.bangla,
    this.followDevice = true,
    this.fixedLat,
    this.fixedLng,
    this.label,
    this.height = 240,
    this.noteOverride,
  });

  final bool bangla;
  final bool followDevice;
  final double? fixedLat;
  final double? fixedLng;
  final String? label;
  final double height;
  final String? noteOverride;

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
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.best, distanceFilter: 8),
    ).listen((position) {
      if (!mounted) return;
      final fix = LiveFix(lat: position.latitude, lng: position.longitude, accuracy: position.accuracy, at: position.timestamp);
      if (!isPreciseFix(fix)) {
        setState(() => _status = 'weak');
        return;
      }
      setState(() {
        _lat = fix.lat;
        _lng = fix.lng;
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
    final key = '${lat.toStringAsFixed(5)},${lng.toStringAsFixed(5)},${widget.bangla}';
    if (!force && key == _loaded) return;
    _loaded = key;
    _controller?.loadRequest(Uri.parse(osmEmbedHref(lat, lng)));
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
    final note = widget.noteOverride ??
        switch (_status) {
          'live' => widget.bangla ? 'এই পিন আপনার লাইভ লোকেশন অনুসরণ করে।' : 'This pin follows your live location.',
          'seeking' => widget.bangla ? 'আপনার লোকেশন খোঁজা হচ্ছে…' : 'Finding your location…',
          'pin' => widget.bangla ? 'এই পিন ঠিক যে কোঅর্ডিনেটে পাঠানো হয়েছে।' : 'This pin sits on the coordinates that were sent.',
          'weak' => widget.bangla ? 'রিডিং খুব চওড়া। সঠিক লোকেশন অনুমতি দিন।' : 'That reading is too wide. Allow a precise location.',
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
            if (_status == 'off' || _status == 'weak')
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
            height: widget.height,
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
