import 'dart:async';
import 'dart:io';

import 'package:path/path.dart' as p;

import 'daemon_info.dart';
import 'ws_client.dart';

/// Locates the monorepo root by walking up from [start] looking for
/// packages/daemon/src/main.ts. Falls back to two levels above [start]
/// (apps/desktop -> apps -> repo root) if the search doesn't find it.
String findProjectRoot({String? start}) {
  var dir = Directory(start ?? Directory.current.path);
  for (var i = 0; i < 8; i++) {
    final candidate = File(
      p.join(dir.path, 'packages', 'daemon', 'src', 'main.ts'),
    );
    if (candidate.existsSync()) return dir.path;
    final parent = dir.parent;
    if (parent.path == dir.path) break;
    dir = parent;
  }
  return p.dirname(p.dirname(start ?? Directory.current.path));
}

/// Starts the daemon as a subprocess.
///
/// TODO(Phase 6): release modunda derlenmiş daemon binary'sine işaret edecek
/// (bu dev-mode implementasyonu `bun run packages/daemon/src/main.ts` çalıştırır).
void spawnDaemon({String? projectRoot}) {
  final root = projectRoot ?? findProjectRoot();
  final daemonEntry = p.join(root, 'packages', 'daemon', 'src', 'main.ts');
  Process.start(
    'bun',
    ['run', daemonEntry],
    mode: ProcessStartMode.detachedWithStdio,
  );
}

Future<WsClient?> tryConnect(DaemonInfo info) async {
  final client = WsClient('ws://127.0.0.1:${info.port}/ws?token=${info.token}');
  try {
    await client.connect();
    return client;
  } catch (_) {
    return null;
  }
}

Future<DaemonInfo> waitForDaemon({int timeoutMs = 5000}) async {
  final start = DateTime.now();
  while (DateTime.now().difference(start).inMilliseconds < timeoutMs) {
    final info = readDaemonInfo();
    if (info != null) return info;
    await Future<void>.delayed(const Duration(milliseconds: 100));
  }
  throw StateError('otoclaw daemon did not start in time');
}

/// daemon.json oku -> bağlanmayı dene -> yoksa spawnDaemon() -> tekrar bekle.
Future<WsClient> ensureConnectedClient({
  void Function({String? projectRoot}) spawn = spawnDaemon,
  String? projectRoot,
}) async {
  final existing = readDaemonInfo();
  if (existing != null) {
    final client = await tryConnect(existing);
    if (client != null) return client;
  }

  spawn(projectRoot: projectRoot);
  final info = await waitForDaemon();
  final client = await tryConnect(info);
  if (client == null) {
    throw StateError('failed to connect to the otoclaw daemon after starting it');
  }
  return client;
}
