import 'dart:convert';
import 'dart:io';

import 'package:desktop/daemon/ws_client.dart';
import 'package:desktop/panels/session_list_panel.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeServer {
  _FakeServer(this._httpServer, this._sockets);

  final HttpServer _httpServer;
  final List<WebSocket> _sockets;
  final List<Map<String, dynamic>> receivedRequests = [];

  int get port => _httpServer.port;

  static Future<_FakeServer> start() async {
    final httpServer = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final sockets = <WebSocket>[];
    httpServer.listen((request) async {
      final socket = await WebSocketTransformer.upgrade(request);
      sockets.add(socket);
    });
    return _FakeServer(httpServer, sockets);
  }

  Future<WebSocket> waitForSocket() async {
    while (_sockets.isEmpty) {
      await Future<void>.delayed(const Duration(milliseconds: 10));
    }
    return _sockets.first;
  }

  Future<void> close() => _httpServer.close(force: true);
}

void main() {
  late _FakeServer server;
  late WsClient client;
  late WebSocket socket;

  setUp(() async {
    server = await _FakeServer.start();
    client = WsClient('ws://127.0.0.1:${server.port}/ws');
    await client.connect();
    socket = await server.waitForSocket();
  });

  tearDown(() async {
    client.close();
    await server.close();
  });

  testWidgets('Create sends session.create with cwd/mode and adds the new session locally', (
    tester,
  ) async {
    final requests = <Map<String, dynamic>>[];
    socket.listen((raw) {
      final msg = jsonDecode(raw as String) as Map<String, dynamic>;
      requests.add(msg);
      socket.add(
        jsonEncode({
          'jsonrpc': '2.0',
          'id': msg['id'],
          'result': {'sessionId': 'session-xyz'},
        }),
      );
    });

    await tester.pumpWidget(
      MaterialApp(home: Scaffold(body: SessionListPanel(client: client))),
    );
    await tester.pump();

    expect(find.text('No sessions yet'), findsOneWidget);

    await tester.enterText(
      find.byKey(const Key('session-cwd-field')),
      '/repo/project',
    );
    await tester.tap(find.byKey(const Key('session-create-button')));
    await tester.runAsync(() async {
      await Future<void>.delayed(const Duration(milliseconds: 50));
    });
    await tester.pump();
    await tester.pump();

    expect(requests, hasLength(1));
    expect(requests.first['method'], 'session.create');
    expect(requests.first['params'], {'cwd': '/repo/project', 'mode': 'manual'});

    expect(find.text('No sessions yet'), findsNothing);
    expect(find.text('session-xyz'), findsOneWidget);
    expect(find.text('/repo/project · manual'), findsOneWidget);
  });
}
