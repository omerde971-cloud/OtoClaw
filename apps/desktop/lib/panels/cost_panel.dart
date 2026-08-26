import 'dart:async';

import 'package:flutter/material.dart';

import '../daemon/ws_client.dart';
import '../protocol/messages.dart';

/// Passive widget that displays the latest `cost.update` notification.
/// Sends no requests. Listens to [costUpdates] if given (for tests),
/// otherwise subscribes to [client]'s `cost.update` notifications.
class CostPanel extends StatefulWidget {
  const CostPanel({
    super.key,
    required this.client,
    this.sessionId,
    this.costUpdates,
  });

  final WsClient client;
  final String? sessionId;
  final Stream<CostUpdatePayload>? costUpdates;

  @override
  State<CostPanel> createState() => _CostPanelState();
}

class _CostPanelState extends State<CostPanel> {
  CostUpdatePayload? _latest;
  StreamSubscription<CostUpdatePayload>? _subscription;
  void Function()? _unsubscribeClient;
  StreamController<CostUpdatePayload>? _controller;

  @override
  void initState() {
    super.initState();
    _subscribe();
  }

  void _subscribe() {
    final provided = widget.costUpdates;
    final Stream<CostUpdatePayload> stream;
    if (provided != null) {
      stream = provided;
    } else {
      final controller = StreamController<CostUpdatePayload>.broadcast();
      _controller = controller;
      _unsubscribeClient = widget.client.on('cost.update', (params) {
        controller.add(
          CostUpdatePayload.fromJson(Map<String, dynamic>.from(params as Map)),
        );
      });
      stream = controller.stream;
    }
    _subscription = stream.listen((payload) {
      if (widget.sessionId != null && payload.sessionId != widget.sessionId) {
        return;
      }
      if (!mounted) return;
      setState(() => _latest = payload);
    });
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _unsubscribeClient?.call();
    _controller?.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final latest = _latest;
    if (latest == null) {
      return const Text('Maliyet verisi bekleniyor');
    }
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Tokens in: ${latest.tokensIn}'),
        Text('Tokens out: ${latest.tokensOut}'),
        Text('USD: ${latest.usd}'),
      ],
    );
  }
}
