import 'package:flutter/material.dart';

import '../daemon/ws_client.dart';
import '../protocol/messages.dart';

class SubAgentRow {
  SubAgentRow({
    required this.agentId,
    required this.role,
    required this.status,
    this.result,
  });

  final String agentId;
  final String role;
  String status;
  SubAgentResultPayload? result;
}

/// Renders sub-agent lifecycle events (subagent.spawn/update/done) for a
/// single session, filtering out events for other sessions.
class SubAgentPanel extends StatefulWidget {
  const SubAgentPanel({
    super.key,
    required this.client,
    required this.currentSessionId,
  });

  final WsClient client;
  final String currentSessionId;

  @override
  State<SubAgentPanel> createState() => _SubAgentPanelState();
}

class _SubAgentPanelState extends State<SubAgentPanel> {
  final List<SubAgentRow> _rows = [];
  final Map<String, SubAgentRow> _byId = {};
  final List<void Function()> _unsubscribers = [];

  @override
  void initState() {
    super.initState();
    _unsubscribers.add(
      widget.client.on('subagent.spawn', _onSpawn),
    );
    _unsubscribers.add(
      widget.client.on('subagent.update', _onUpdate),
    );
    _unsubscribers.add(
      widget.client.on('subagent.done', _onDone),
    );
  }

  @override
  void dispose() {
    for (final unsubscribe in _unsubscribers) {
      unsubscribe();
    }
    super.dispose();
  }

  void _onSpawn(Object? params) {
    final payload = SubAgentSpawnPayload.fromJson(
      Map<String, dynamic>.from(params as Map),
    );
    if (payload.sessionId != widget.currentSessionId) return;
    setState(() {
      final row = SubAgentRow(
        agentId: payload.agentId,
        role: payload.role,
        status: payload.status,
      );
      _byId[payload.agentId] = row;
      _rows.add(row);
    });
  }

  void _onUpdate(Object? params) {
    final payload = SubAgentUpdatePayload.fromJson(
      Map<String, dynamic>.from(params as Map),
    );
    if (payload.sessionId != widget.currentSessionId) return;
    final row = _byId[payload.agentId];
    if (row == null) return;
    setState(() {
      row.status = payload.status;
    });
  }

  void _onDone(Object? params) {
    final payload = SubAgentDonePayload.fromJson(
      Map<String, dynamic>.from(params as Map),
    );
    if (payload.sessionId != widget.currentSessionId) return;
    final row = _byId[payload.agentId];
    if (row == null) return;
    setState(() {
      row.status = payload.status;
      row.result = payload.result;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_rows.isEmpty) {
      return const Center(child: Text('No sub-agents yet'));
    }
    return ListView.builder(
      itemCount: _rows.length,
      itemBuilder: (context, index) {
        final row = _rows[index];
        final result = row.result;
        return ListTile(
          key: ValueKey(row.agentId),
          leading: result == null
              ? const Icon(Icons.hourglass_top)
              : Icon(
                  result.ok ? Icons.check_circle : Icons.error,
                  color: result.ok ? Colors.green : Colors.red,
                ),
          title: Text('${row.role} (${row.agentId})'),
          subtitle: Text(
            result == null
                ? row.status
                : '${row.status} · tokens=${result.tokensUsed} steps=${result.stepsUsed}',
          ),
        );
      },
    );
  }
}
