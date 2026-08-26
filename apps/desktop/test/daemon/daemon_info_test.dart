import 'dart:convert';
import 'dart:io';

import 'package:desktop/daemon/daemon_info.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;

void main() {
  late Directory tempHome;

  setUp(() {
    tempHome = Directory.systemTemp.createTempSync('otoclaw_test_home_');
  });

  tearDown(() {
    tempHome.deleteSync(recursive: true);
  });

  test('otoclawDir() joins home with .otoclaw', () {
    expect(
      otoclawDir(homeOverride: tempHome.path),
      p.join(tempHome.path, '.otoclaw'),
    );
  });

  test('readDaemonInfo() returns null when daemon.json does not exist', () {
    expect(
      File(daemonJsonPath(homeOverride: tempHome.path)).existsSync(),
      isFalse,
    );
    final info = readDaemonInfo(homeOverride: tempHome.path);
    expect(info, isNull);
  });

  test('readDaemonInfo() parses a valid daemon.json', () {
    final path = daemonJsonPath(homeOverride: tempHome.path);
    Directory(p.dirname(path)).createSync(recursive: true);
    File(path).writeAsStringSync(
      jsonEncode({
        'port': 4321,
        'token': 'secret-token',
        'pid': 1234,
        'startedAt': '2026-08-26T00:00:00.000Z',
      }),
    );
    final info = readDaemonInfo(homeOverride: tempHome.path);
    expect(info, isNotNull);
    expect(info!.port, 4321);
    expect(info.token, 'secret-token');
    expect(info.pid, 1234);
    expect(info.startedAt, '2026-08-26T00:00:00.000Z');
  });

  test('readDaemonInfo() returns null for corrupt JSON', () {
    final path = daemonJsonPath(homeOverride: tempHome.path);
    Directory(p.dirname(path)).createSync(recursive: true);
    File(path).writeAsStringSync('{not valid json');
    final info = readDaemonInfo(homeOverride: tempHome.path);
    expect(info, isNull);
  });

  test('readDaemonInfo() returns null for JSON missing required fields', () {
    final path = daemonJsonPath(homeOverride: tempHome.path);
    Directory(p.dirname(path)).createSync(recursive: true);
    File(path).writeAsStringSync(jsonEncode({'port': 4321}));
    final info = readDaemonInfo(homeOverride: tempHome.path);
    expect(info, isNull);
  });
}
