import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:sensors_plus/sensors_plus.dart';
import 'package:safely_mobile/sos_panel.dart';

/// Pure shake detector so widget tests can feed accelerometer samples without hardware.
class ShakeDetector {
  ShakeDetector({
    this.threshold = 18,
    this.cooldown = const Duration(seconds: 4),
  });

  final double threshold;
  final Duration cooldown;

  double? _lastX;
  double? _lastY;
  double? _lastZ;
  DateTime? _lastFire;

  /// Returns true when the sample looks like a deliberate shake.
  bool consider(AccelerometerEvent event) {
    final previousX = _lastX;
    final previousY = _lastY;
    final previousZ = _lastZ;
    _lastX = event.x;
    _lastY = event.y;
    _lastZ = event.z;
    if (previousX == null || previousY == null || previousZ == null) return false;

    final delta = math.sqrt(
      math.pow(event.x - previousX, 2) + math.pow(event.y - previousY, 2) + math.pow(event.z - previousZ, 2),
    );
    if (delta < threshold) return false;

    final now = DateTime.now();
    if (_lastFire != null && now.difference(_lastFire!) < cooldown) return false;
    _lastFire = now;
    return true;
  }

  void reset() {
    _lastX = null;
    _lastY = null;
    _lastZ = null;
    _lastFire = null;
  }
}

/// Listens for shakes and starts the cancelable SOS countdown only — never sends instantly.
class ShakeToSosListener extends StatefulWidget {
  const ShakeToSosListener({
    super.key,
    required this.enabled,
    required this.onStartCountdown,
    required this.child,
    this.accelerometerStream,
    this.detector,
  });

  final bool enabled;

  /// Must only start the cancelable countdown (or UI that wraps it). Must not send SOS immediately.
  final Future<void> Function() onStartCountdown;
  final Widget child;

  /// Injected in tests. Defaults to [accelerometerEventStream].
  final Stream<AccelerometerEvent>? accelerometerStream;
  final ShakeDetector? detector;

  @override
  State<ShakeToSosListener> createState() => _ShakeToSosListenerState();
}

class _ShakeToSosListenerState extends State<ShakeToSosListener> {
  late final ShakeDetector _detector;
  StreamSubscription<AccelerometerEvent>? _sub;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _detector = widget.detector ?? ShakeDetector();
    _bind();
  }

  @override
  void didUpdateWidget(covariant ShakeToSosListener oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.enabled != widget.enabled || oldWidget.accelerometerStream != widget.accelerometerStream) {
      _bind();
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  void _bind() {
    _sub?.cancel();
    _sub = null;
    _busy = false;
    _detector.reset();
    if (!widget.enabled) return;
    final stream = widget.accelerometerStream ?? accelerometerEventStream();
    _sub = stream.listen((event) async {
      if (!widget.enabled || _busy) return;
      if (!_detector.consider(event)) return;
      _busy = true;
      try {
        // onStartCountdown runs its sync work (e.g. setState → SosCountdown) before any await.
        await widget.onStartCountdown();
      } finally {
        _busy = false;
      }
    });
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

/// Test host: a shake shows [SosCountdown] and never calls [onSend] until the countdown completes.
class ShakeSosCountdownHost extends StatefulWidget {
  const ShakeSosCountdownHost({
    super.key,
    required this.enabled,
    required this.accelerometerStream,
    this.onSend,
    this.seconds = 3,
  });

  final bool enabled;
  final Stream<AccelerometerEvent> accelerometerStream;
  final VoidCallback? onSend;
  final int seconds;

  @override
  State<ShakeSosCountdownHost> createState() => _ShakeSosCountdownHostState();
}

class _ShakeSosCountdownHostState extends State<ShakeSosCountdownHost> {
  bool _counting = false;
  final _detector = ShakeDetector(threshold: 12, cooldown: const Duration(milliseconds: 500));
  Completer<void>? _gate;

  Future<void> _onShake() async {
    if (_counting) return;
    final gate = Completer<void>();
    _gate = gate;
    setState(() => _counting = true);
    // Stay "busy" until cancel/complete so a second shake cannot skip the countdown.
    return gate.future;
  }

  void _finish({required bool send}) {
    if (send) widget.onSend?.call();
    final gate = _gate;
    if (gate != null && !gate.isCompleted) gate.complete();
    setState(() => _counting = false);
  }

  @override
  Widget build(BuildContext context) {
    return ShakeToSosListener(
      enabled: widget.enabled,
      accelerometerStream: widget.accelerometerStream,
      detector: _detector,
      onStartCountdown: _onShake,
      child: Scaffold(
        body: Center(
          child: _counting
              ? SosCountdown(
                  seconds: widget.seconds,
                  onCancel: () => _finish(send: false),
                  onComplete: () => _finish(send: true),
                )
              : const Text('waiting'),
        ),
      ),
    );
  }
}
