import 'package:flutter/material.dart';

import 'app.dart';
import 'daemon/daemon_lifecycle.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final client = await ensureConnectedClient();
  runApp(OtoClawApp(client: client));
}
