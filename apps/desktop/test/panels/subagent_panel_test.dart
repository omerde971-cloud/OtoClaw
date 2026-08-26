import 'dart:convert';
import 'dart:io';

import 'package:desktop/daemon/ws_client.dart';
import 'package:desktop/panels/subagent_panel.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeServer {
  _FakeServer(this._httpServer, this._sockets);

  final HttpServer _httpServer;
  final List<WebSocket> _sockets;

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

Map<String, dynamic> _brief() => {
  'role': 'coder',
  'goal': 'do the thing',
  'inputs': <String, dynamic>{},
  'constraints': <String>[],
  'acceptance': <String>[],
  'budget': {'tokens': 1000, 'steps': 10},
};

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

  testWidgets('spawn -> update -> done drives row state for matching session', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SubAgentPanel(client: client, currentSessionId: 's1'),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('No sub-agents yet'), findsOneWidget);

    await tester.runAsync(() async {
      socket.add(
        jsonEncode({
          'jsonrpc': '2.0',
          'method': 'subagent.spawn',
          'params': {
            'sessionId': 's1',
            'agentId': 'a1',
            'role': 'coder',
            'brief': _brief(),
            'status': 'spawned',
          },
        }),
      );
      await Future<void>.delayed(const Duration(milliseconds: 50));
    });
    await tester.pump();
    expect(find.textContaining('coder (a1)'), findsOneWidget);
    expect(find.text('spawned'), findsOneWidget);

    await tester.runAsync(() async {
      socket.add(
        jsonEncode({
          'jsonrpc': '2.0',
          'method': 'subagent.update',
          'params': {
            'sessionId': 's1',
            'agentId': 'a1',
            'role': 'coder',
            'brief': _brief(),
            'status': 'running',
          },
        }),
      );
      await Future<void>.delayed(const Duration(milliseconds: 50));
    });
    await tester.pump();
    expect(find.text('running'), findsOneWidget);

    await tester.runAsync(() async {
      socket.add(
        jsonEncode({
          'jsonrpc': '2.0',
          'method': 'subagent.done',
          'params': {
            'sessionId': 's1',
            'agentId': 'a1',
            'role': 'coder',
            'brief': _brief(),
            'status': 'done',
            'result': {
              'agentId': 'a1',
              'role': 'coder',
              'ok': true,
              'text': 'done',
              'notes': <String>[],
              'tokensUsed': 42,
              'stepsUsed': 3,
              'worktree': null,
            },
          },
        }),
      );
      await Future<void>.delayed(const Duration(milliseconds: 50));
    });
    await tester.pump();
    expect(find.textContaining('done · tokens=42 steps=3'), findsOneWidget);
  });

  testWidgets('events for a different sessionId are ignored', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SubAgentPanel(client: client, currentSessionId: 's1'),
        ),
      ),
    );
    await tester.pump();

    await tester.runAsync(() async {
      socket.add(
        jsonEncode({
          'jsonrpc': '2.0',
          'method': 'subagent.spawn',
          'params': {
            'sessionId': 'other-session',
            'agentId': 'a1',
            'role': 'coder',
            'brief': _brief(),
            'status': 'spawned',
          },
        }),
      );
      await Future<void>.delayed(const Duration(milliseconds: 50));
    });
    await tester.pump();

    expect(find.text('No sub-agents yet'), findsOneWidget);
    expect(find.textContaining('coder (a1)'), findsNothing);
  });
}
