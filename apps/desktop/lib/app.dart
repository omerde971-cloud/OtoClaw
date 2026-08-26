import 'package:flutter/material.dart';

import 'daemon/ws_client.dart';

/// Placeholder shell. Mascot/terminal/dialog/panel widgets land in 3b/3c/3d.
class OtoClawApp extends StatelessWidget {
  const OtoClawApp({super.key, required this.client});

  final WsClient client;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'OtoClaw',
      theme: ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple)),
      home: const Scaffold(
        body: Center(child: Text('OtoClaw')),
      ),
    );
  }
}
