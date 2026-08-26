import 'dart:async';

import 'package:flutter/widgets.dart';

import '../daemon/ws_client.dart';
import '../protocol/messages.dart';
import 'fallback_mascot_renderer.dart';
import 'mascot_renderer.dart';
import 'mascot_state.dart';
import 'rive_mascot_renderer.dart';

/// Listens for `mascot.state` notifications (from [wsClient], or directly
/// from [stateStream] in tests) and cross-fades between the matching
/// [MascotRenderer] widgets.
class MascotWidget extends StatefulWidget {
  MascotWidget({super.key, this.wsClient, this.stateStream, MascotRenderer? renderer})
    : renderer = renderer ?? RiveMascotRenderer(fallback: FallbackMascotRenderer());

  final WsClient? wsClient;
  final Stream<MascotStatePayload>? stateStream;
  final MascotRenderer renderer;

  @override
  State<MascotWidget> createState() => _MascotWidgetState();
}

class _MascotWidgetState extends State<MascotWidget> {
  MascotStateName _current = MascotStateName.idle;
  StreamSubscription<MascotStatePayload>? _subscription;
  void Function()? _unsubscribeWs;

  @override
  void initState() {
    super.initState();
    if (widget.stateStream != null) {
      _subscription = widget.stateStream!.listen(_onPayload);
    } else if (widget.wsClient != null) {
      _unsubscribeWs = widget.wsClient!.on('mascot.state', (params) {
        if (params is Map) {
          _onPayload(
            MascotStatePayload.fromJson(Map<String, dynamic>.from(params)),
          );
        }
      });
    }
  }

  void _onPayload(MascotStatePayload payload) {
    if (!mounted) return;
    setState(() {
      _current = mascotStateFromWire(payload.state);
    });
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _unsubscribeWs?.call();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 250),
      child: KeyedSubtree(
        key: ValueKey(_current),
        child: widget.renderer.build(context, _current),
      ),
    );
  }
}
