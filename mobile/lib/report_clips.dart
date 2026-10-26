import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import 'package:safely_mobile/campus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:video_player/video_player.dart';

const voiceMaxSeconds = 60;
const videoMaxSeconds = 30;
const voiceMaxBytes = 10 * 1024 * 1024;
const videoMaxBytes = 20 * 1024 * 1024;

class ReportClip {
  const ReportClip({required this.path, required this.mime, required this.seconds, required this.bytes});

  final String path;
  final String mime;
  final int seconds;
  final int bytes;
}

String? clipProblem({required bool video, required String mime, required int bytes, required int seconds}) {
  if (video) {
    const allowed = {'video/mp4', 'video/webm', 'video/quicktime'};
    if (!allowed.contains(mime)) return 'Use an MP4, WebM, or MOV video.';
    if (bytes > videoMaxBytes) return 'Videos must be 20 MB or smaller.';
    if (seconds <= 0 || seconds > videoMaxSeconds) return 'Videos must be 30 seconds or shorter.';
    return null;
  }
  const allowed = {'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/x-m4a'};
  if (!allowed.contains(mime)) return 'Use a WebM, M4A, MP3, or AAC voice note.';
  if (bytes > voiceMaxBytes) return 'Voice notes must be 10 MB or smaller.';
  if (seconds <= 0 || seconds > voiceMaxSeconds) return 'Voice notes must be 60 seconds or shorter.';
  return null;
}

/// Removes an ID3v2 header. AAC from the recorder has none.
List<int> stripAudioId3(List<int> bytes) {
  if (bytes.length < 10 || bytes[0] != 0x49 || bytes[1] != 0x44 || bytes[2] != 0x33) return bytes;
  final size = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
  final start = 10 + size;
  if (start >= bytes.length) return bytes;
  return bytes.sublist(start);
}

class VoiceRecorder {
  VoiceRecorder();

  final AudioRecorder _recorder = AudioRecorder();
  Timer? _timer;
  DateTime? _started;

  Future<String?> start() async {
    if (!await _recorder.hasPermission()) return 'Microphone permission is required.';
    final dir = await getTemporaryDirectory();
    final path = '${dir.path}/safely-voice.m4a';
    await _recorder.start(const RecordConfig(encoder: AudioEncoder.aacLc), path: path);
    _started = DateTime.now();
    _timer = Timer(const Duration(seconds: voiceMaxSeconds), () {
      unawaited(stop());
    });
    return null;
  }

  Future<ReportClip?> stop() async {
    _timer?.cancel();
    final path = await _recorder.stop();
    final started = _started;
    _started = null;
    if (path == null || started == null) return null;
    final seconds = DateTime.now().difference(started).inSeconds.clamp(1, voiceMaxSeconds);
    final file = File(path);
    final bytes = await file.length();
    final problem = clipProblem(video: false, mime: 'audio/mp4', bytes: bytes, seconds: seconds);
    if (problem != null) {
      await file.delete();
      throw StateError(problem);
    }
    return ReportClip(path: path, mime: 'audio/mp4', seconds: seconds, bytes: bytes);
  }

  void dispose() {
    _timer?.cancel();
    unawaited(_recorder.dispose());
  }
}

Future<ReportClip?> pickReportVideo() async {
  final picked = await ImagePicker().pickVideo(source: ImageSource.gallery, maxDuration: const Duration(seconds: videoMaxSeconds));
  if (picked == null) return null;
  final file = File(picked.path);
  final bytes = await file.length();
  final mime = picked.mimeType ?? 'video/mp4';
  final controller = VideoPlayerController.file(file);
  try {
    await controller.initialize();
    final seconds = controller.value.duration.inSeconds;
    final problem = clipProblem(video: true, mime: mime, bytes: bytes, seconds: seconds <= 0 ? 1 : seconds);
    if (problem != null) throw StateError(problem);
    return ReportClip(path: picked.path, mime: mime, seconds: seconds <= 0 ? 1 : seconds, bytes: bytes);
  } finally {
    await controller.dispose();
  }
}

class ReportClipPlayer extends StatefulWidget {
  const ReportClipPlayer({super.key, required this.label, required this.storagePath, this.filePath});

  final String label;
  final String? storagePath;
  final String? filePath;

  @override
  State<ReportClipPlayer> createState() => _ReportClipPlayerState();
}

class _ReportClipPlayerState extends State<ReportClipPlayer> {
  VideoPlayerController? _controller;
  String? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_open());
  }

  @override
  void dispose() {
    unawaited(_controller?.dispose());
    super.dispose();
  }

  Future<void> _open() async {
    try {
      final VideoPlayerController controller;
      if (widget.filePath != null && widget.filePath!.isNotEmpty) {
        controller = VideoPlayerController.file(File(widget.filePath!));
      } else if (widget.storagePath != null && widget.storagePath!.isNotEmpty) {
        final signed = await Supabase.instance.client.storage.from('report-media').createSignedUrl(widget.storagePath!, 600);
        controller = VideoPlayerController.networkUrl(Uri.parse(signed));
      } else {
        return;
      }
      await controller.initialize();
      if (!mounted) {
        await controller.dispose();
        return;
      }
      setState(() => _controller = controller);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.label, style: const TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 8),
        if (_error != null) Text(widget.label, style: const TextStyle(color: Color(0xFF5B6B7C)))
        else if (controller == null) const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(strokeWidth: 2))
        else
          Column(
            children: [
              if (controller.value.aspectRatio > 0) AspectRatio(aspectRatio: controller.value.aspectRatio, child: VideoPlayer(controller)),
              IconButton(
                onPressed: () {
                  if (controller.value.isPlaying) {
                    controller.pause();
                  } else {
                    controller.play();
                  }
                  setState(() {});
                },
                icon: Icon(controller.value.isPlaying ? Icons.pause : Icons.play_arrow),
              ),
            ],
          ),
      ],
    );
  }
}

Future<void> uploadReportClip(CampusStore store, String reportId, ReportClip clip, {required bool video}) async {
  if (!store.remote) return;
  final ext = video ? _videoExt(clip.mime) : 'm4a';
  final name = '${video ? 'video' : 'voice'}.$ext';
  final bytes = stripAudioId3(await File(clip.path).readAsBytes());
  await Supabase.instance.client.storage.from('report-media').uploadBinary(
    '$reportId/$name',
    bytes is Uint8List ? bytes : Uint8List.fromList(bytes),
    fileOptions: FileOptions(contentType: clip.mime, upsert: true),
  );
  await Supabase.instance.client.from('reports').update({
    video ? 'video' : 'voice_note': {
      'path': '$reportId/$name',
      'name': name,
      'mime': clip.mime,
      'seconds': clip.seconds,
      'bytes': bytes.length,
    },
  }).eq('id', reportId);
}

String _videoExt(String mime) {
  switch (mime) {
    case 'video/webm':
      return 'webm';
    case 'video/quicktime':
      return 'mov';
    default:
      return 'mp4';
  }
}
