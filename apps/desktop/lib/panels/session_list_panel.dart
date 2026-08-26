import 'package:flutter/material.dart';

import '../daemon/ws_client.dart';
import '../protocol/messages.dart';

class SessionListEntry {
  const SessionListEntry({
    required this.sessionId,
    required this.cwd,
    required this.mode,
  });

  final String sessionId;
  final String cwd;
  final String mode;
}

/// Creates sessions via session.create and keeps a local list of the ones
/// created this run. The protocol does not expose session.list/session.get,
/// so this widget never fetches a list from the daemon.
class SessionListPanel extends StatefulWidget {
  const SessionListPanel({super.key, required this.client});

  final WsClient client;

  @override
  State<SessionListPanel> createState() => _SessionListPanelState();
}

class _SessionListPanelState extends State<SessionListPanel> {
  final List<SessionListEntry> _sessions = [];
  final TextEditingController _cwdController = TextEditingController();
  String _mode = 'manual';
  bool _creating = false;
  String? _error;

  @override
  void dispose() {
    _cwdController.dispose();
    super.dispose();
  }

  Future<void> _createSession() async {
    final cwd = _cwdController.text.trim();
    if (cwd.isEmpty || _creating) return;
    setState(() {
      _creating = true;
      _error = null;
    });
    try {
      final params = SessionCreateParams(cwd: cwd, mode: _mode);
      final result = await widget.client.request<Map<String, dynamic>>(
        'session.create',
        params.toJson(),
      );
      final created = SessionCreateResult.fromJson(result);
      setState(() {
        _sessions.add(
          SessionListEntry(
            sessionId: created.sessionId,
            cwd: cwd,
            mode: _mode,
          ),
        );
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
      });
    } finally {
      setState(() {
        _creating = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.all(8.0),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  key: const Key('session-cwd-field'),
                  controller: _cwdController,
                  decoration: const InputDecoration(labelText: 'cwd'),
                ),
              ),
              const SizedBox(width: 8),
              DropdownButton<String>(
                key: const Key('session-mode-dropdown'),
                value: _mode,
                items: const [
                  DropdownMenuItem(value: 'manual', child: Text('manual')),
                  DropdownMenuItem(value: 'auto', child: Text('auto')),
                ],
                onChanged: (value) {
                  if (value != null) setState(() => _mode = value);
                },
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                key: const Key('session-create-button'),
                onPressed: _creating ? null : _createSession,
                child: const Text('Create'),
              ),
            ],
          ),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8.0),
            child: Text(_error!, style: const TextStyle(color: Colors.red)),
          ),
        Expanded(
          child: _sessions.isEmpty
              ? const Center(child: Text('No sessions yet'))
              : ListView.builder(
                  itemCount: _sessions.length,
                  itemBuilder: (context, index) {
                    final entry = _sessions[index];
                    return ListTile(
                      key: ValueKey(entry.sessionId),
                      title: Text(entry.sessionId),
                      subtitle: Text('${entry.cwd} · ${entry.mode}'),
                    );
                  },
                ),
        ),
      ],
    );
  }
}
