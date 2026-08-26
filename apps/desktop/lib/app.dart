import 'package:flutter/material.dart';

import 'daemon/ws_client.dart';
import 'mascot/mascot_widget.dart';
import 'panels/cost_panel.dart';
import 'panels/model_panel.dart';
import 'panels/subagent_panel.dart';
import 'protocol/messages.dart';
import 'session/session_screen.dart';

class OtoClawApp extends StatelessWidget {
  const OtoClawApp({super.key, required this.client});

  final WsClient client;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'OtoClaw',
      theme: ThemeData.dark(useMaterial3: true).copyWith(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFFF8800),
          brightness: Brightness.dark,
        ),
      ),
      home: HomeScreen(client: client),
    );
  }
}

/// Creates a session on startup, then hosts the mascot + terminal/dialogs +
/// side panels for it. A connection/session-creation failure shows a retry
/// screen instead of leaving the window blank or letting the process exit
/// before a window ever appears.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.client});

  final WsClient client;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String? _sessionId;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _createSession();
  }

  Future<void> _createSession() async {
    setState(() => _error = null);
    try {
      final result = await widget.client.request<Object?>(
        'session.create',
        SessionCreateParams(cwd: '.', mode: 'manual').toJson(),
      );
      final session = SessionCreateResult.fromJson(
        Map<String, dynamic>.from(result as Map),
      );
      if (!mounted) return;
      setState(() => _sessionId = session.sessionId);
    } catch (err) {
      if (!mounted) return;
      setState(() => _error = err);
    }
  }

  @override
  Widget build(BuildContext context) {
    final error = _error;
    if (error != null) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: Colors.redAccent, size: 40),
              const SizedBox(height: 12),
              Text('Daemon bağlantısı kurulamadı:\n$error', textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton(onPressed: _createSession, child: const Text('Tekrar dene')),
            ],
          ),
        ),
      );
    }

    final sessionId = _sessionId;
    if (sessionId == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(title: const Text('OtoClaw')),
      body: Row(
        children: [
          Expanded(
            flex: 3,
            child: Column(
              children: [
                SizedBox(
                  height: 220,
                  child: MascotWidget(wsClient: widget.client),
                ),
                Expanded(
                  child: SessionScreen(client: widget.client, sessionId: sessionId),
                ),
              ],
            ),
          ),
          SizedBox(
            width: 280,
            child: Container(
              decoration: BoxDecoration(
                border: Border(left: BorderSide(color: Theme.of(context).dividerColor)),
              ),
              padding: const EdgeInsets.all(12),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Model', style: TextStyle(fontWeight: FontWeight.bold)),
                    ModelPanel(client: widget.client, sessionId: sessionId),
                    const SizedBox(height: 16),
                    const Text('Maliyet', style: TextStyle(fontWeight: FontWeight.bold)),
                    CostPanel(client: widget.client, sessionId: sessionId),
                    const SizedBox(height: 16),
                    const Text('Alt-ajanlar', style: TextStyle(fontWeight: FontWeight.bold)),
                    SubAgentPanel(client: widget.client, currentSessionId: sessionId),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
