import 'package:flutter/material.dart';

import 'app.dart';
import 'daemon/daemon_lifecycle.dart';
import 'daemon/ws_client.dart';

void main() {
  // A window must always appear, even if the daemon can never be reached —
  // doing the connection attempt inside runApp's widget tree (instead of
  // awaiting it before runApp) guarantees that: worst case, the user sees a
  // visible error/retry screen instead of the process silently exiting
  // before any UI is ever created.
  runApp(const OtoClawBoot());
}

class OtoClawBoot extends StatefulWidget {
  const OtoClawBoot({super.key});

  @override
  State<OtoClawBoot> createState() => _OtoClawBootState();
}

class _OtoClawBootState extends State<OtoClawBoot> {
  WsClient? _client;
  Object? _error;

  @override
  void initState() {
    super.initState();
    _connect();
  }

  Future<void> _connect() async {
    setState(() {
      _error = null;
      _client = null;
    });
    try {
      final client = await ensureConnectedClient();
      if (!mounted) return;
      setState(() => _client = client);
    } catch (err) {
      if (!mounted) return;
      setState(() => _error = err);
    }
  }

  @override
  Widget build(BuildContext context) {
    final client = _client;
    if (client != null) {
      return OtoClawApp(client: client);
    }

    final error = _error;
    return MaterialApp(
      title: 'OtoClaw',
      theme: ThemeData.dark(useMaterial3: true),
      home: Scaffold(
        body: Center(
          child: error == null
              ? const CircularProgressIndicator()
              : Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline, color: Colors.redAccent, size: 40),
                    const SizedBox(height: 12),
                    Text('Daemon bağlantısı kurulamadı:\n$error', textAlign: TextAlign.center),
                    const SizedBox(height: 16),
                    FilledButton(onPressed: _connect, child: const Text('Tekrar dene')),
                  ],
                ),
        ),
      ),
    );
  }
}
