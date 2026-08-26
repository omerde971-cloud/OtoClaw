import 'dart:convert';
import 'dart:io';

import 'package:path/path.dart' as p;

/// Mirrors packages/shared/src/config.ts DaemonRuntimeInfoSchema and the
/// ~/.otoclaw/daemon.json file written by packages/daemon/src/server.ts.
class DaemonInfo {
  const DaemonInfo({
    required this.port,
    required this.token,
    required this.pid,
    required this.startedAt,
  });

  final int port;
  final String token;
  final int pid;
  final String startedAt;

  factory DaemonInfo.fromJson(Map<String, dynamic> json) {
    return DaemonInfo(
      port: json['port'] as int,
      token: json['token'] as String,
      pid: json['pid'] as int,
      startedAt: json['startedAt'] as String,
    );
  }

  Map<String, dynamic> toJson() => {
    'port': port,
    'token': token,
    'pid': pid,
    'startedAt': startedAt,
  };
}

/// [homeOverride] exists for testability; production callers omit it and
/// get USERPROFILE (Windows) falling back to HOME.
String otoclawDir({String? homeOverride}) {
  final home =
      homeOverride ??
      Platform.environment['USERPROFILE'] ??
      Platform.environment['HOME'];
  if (home == null || home.isEmpty) {
    throw StateError('cannot determine home directory (USERPROFILE/HOME unset)');
  }
  return p.join(home, '.otoclaw');
}

String daemonJsonPath({String? homeOverride}) =>
    p.join(otoclawDir(homeOverride: homeOverride), 'daemon.json');

/// Reads and parses daemon.json. Returns null if the file is missing or
/// its contents are malformed — never throws.
DaemonInfo? readDaemonInfo({String? homeOverride}) {
  final file = File(daemonJsonPath(homeOverride: homeOverride));
  if (!file.existsSync()) return null;
  try {
    final parsed = jsonDecode(file.readAsStringSync());
    if (parsed is! Map) return null;
    final map = Map<String, dynamic>.from(parsed);
    if (map['port'] is! int ||
        map['token'] is! String ||
        map['pid'] is! int ||
        map['startedAt'] is! String) {
      return null;
    }
    return DaemonInfo.fromJson(map);
  } catch (_) {
    return null;
  }
}
