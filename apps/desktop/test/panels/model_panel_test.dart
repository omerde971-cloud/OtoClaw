import 'dart:convert';
import 'dart:io';

import 'package:desktop/daemon/ws_client.dart';
import 'package:desktop/panels/model_panel.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Minimal fake daemon backed by dart:io's HttpServer + WebSocketTransformer.
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

/// Pumps bounded frames until [condition] is true. `tester.pump(duration)`
/// only advances flutter_test's fake clock — it never yields to the real
/// event loop, so real socket bytes arriving via dart:io never get a
/// chance to run unless we explicitly give the real event loop a turn via
/// `runAsync` on each iteration, then flush the resulting widget rebuild
/// with a plain pump.
Future<void> _pumpUntil(WidgetTester tester, bool Function() condition) async {
  for (var i = 0; i < 100; i++) {
    if (condition()) return;
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 10)));
    await tester.pump();
  }
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

  testWidgets('renders model list from model.list and sends model.set on selection', (
    tester,
  ) async {
    final receivedMethods = <String>[];
    Map<String, dynamic>? lastSetParams;

    socket.listen((raw) {
      final msg = jsonDecode(raw as String) as Map<String, dynamic>;
      receivedMethods.add(msg['method'] as String);
      if (msg['method'] == 'model.list') {
        socket.add(
          jsonEncode({
            'jsonrpc': '2.0',
            'id': msg['id'],
            'result': [
              {
                'id': 'claude-sonnet',
                'provider': 'anthropic',
                'contextWindow': 200000,
                'supportsTools': true,
                'supportsVision': true,
              },
              {
                'id': 'gpt-5',
                'provider': 'openai',
                'contextWindow': 128000,
                'supportsTools': true,
                'supportsVision': false,
              },
            ],
          }),
        );
      } else if (msg['method'] == 'model.set') {
        lastSetParams = Map<String, dynamic>.from(msg['params'] as Map);
        socket.add(
          jsonEncode({'jsonrpc': '2.0', 'id': msg['id'], 'result': {'ok': true}}),
        );
      }
    });

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ModelPanel(client: client, sessionId: 'session-1'),
        ),
      ),
    );
    await tester.pump();
    await _pumpUntil(tester, () => find.byType(DropdownButton<String>).evaluate().isNotEmpty);

    expect(receivedMethods, contains('model.list'));
    expect(find.byType(DropdownButton<String>), findsOneWidget);

    await tester.tap(find.byType(DropdownButton<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('gpt-5 (openai)').last);
    await tester.pump();
    await _pumpUntil(tester, () => receivedMethods.contains('model.set'));
    await tester.pump();

    expect(receivedMethods, contains('model.set'));
    expect(lastSetParams, {'sessionId': 'session-1', 'model': 'gpt-5'});
  });

  testWidgets('shows an error instead of crashing when model.list fails', (tester) async {
    socket.listen((raw) {
      final msg = jsonDecode(raw as String) as Map<String, dynamic>;
      socket.add(
        jsonEncode({
          'jsonrpc': '2.0',
          'id': msg['id'],
          'error': {'code': -32000, 'message': 'daemon unavailable'},
        }),
      );
    });

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ModelPanel(client: client, sessionId: 'session-1'),
        ),
      ),
    );
    await tester.pump();
    await _pumpUntil(
      tester,
      () => find.textContaining('daemon unavailable').evaluate().isNotEmpty,
    );

    expect(find.textContaining('daemon unavailable'), findsOneWidget);
    expect(find.byType(DropdownButton<String>), findsNothing);
  });
}
