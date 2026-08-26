import 'dart:convert';
import 'dart:io';

import 'package:desktop/daemon/ws_client.dart';
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

void main() {
  late _FakeServer server;

  setUp(() async {
    server = await _FakeServer.start();
  });

  tearDown(() async {
    await server.close();
  });

  test('request() resolves with the result matching the response id', () async {
    final client = WsClient('ws://127.0.0.1:${server.port}/ws');
    await client.connect();
    final socket = await server.waitForSocket();

    socket.listen((raw) {
      final msg = jsonDecode(raw as String) as Map<String, dynamic>;
      socket.add(
        jsonEncode({
          'jsonrpc': '2.0',
          'id': msg['id'],
          'result': {'echoed': msg['method']},
        }),
      );
    });

    final result = await client.request<Map<String, dynamic>>(
      'session.create',
      {'cwd': '/tmp', 'mode': 'manual'},
    );
    expect(result['echoed'], 'session.create');

    client.close();
  });

  test('request() rejects when the response carries an error', () async {
    final client = WsClient('ws://127.0.0.1:${server.port}/ws');
    await client.connect();
    final socket = await server.waitForSocket();

    socket.listen((raw) {
      final msg = jsonDecode(raw as String) as Map<String, dynamic>;
      socket.add(
        jsonEncode({
          'jsonrpc': '2.0',
          'id': msg['id'],
          'error': {'code': -32601, 'message': 'Method not found'},
        }),
      );
    });

    await expectLater(
      client.request<void>('unknown.method', {}),
      throwsA(
        isA<StateError>().having(
          (e) => e.message,
          'message',
          'Method not found',
        ),
      ),
    );

    client.close();
  });

  test('multiple concurrent requests resolve to the matching id', () async {
    final client = WsClient('ws://127.0.0.1:${server.port}/ws');
    await client.connect();
    final socket = await server.waitForSocket();

    socket.listen((raw) {
      final msg = jsonDecode(raw as String) as Map<String, dynamic>;
      // Reply out of order to prove id-based correlation, not arrival order.
      Future<void>.delayed(Duration(milliseconds: msg['id'] == 1 ? 20 : 5), () {
        socket.add(
          jsonEncode({
            'jsonrpc': '2.0',
            'id': msg['id'],
            'result': msg['id'],
          }),
        );
      });
    });

    final first = client.request<int>('a', {});
    final second = client.request<int>('b', {});
    final results = await Future.wait([first, second]);
    expect(results, [1, 2]);

    client.close();
  });

  test('on() dispatches notifications by method name', () async {
    final client = WsClient('ws://127.0.0.1:${server.port}/ws');
    await client.connect();
    final socket = await server.waitForSocket();

    final received = <Object?>[];
    final unsubscribe = client.on('echo', (params) => received.add(params));

    socket.add(
      jsonEncode({
        'jsonrpc': '2.0',
        'method': 'echo',
        'params': {'sessionId': 's1', 'message': 'hi', 'ts': 'now'},
      }),
    );

    await Future<void>.delayed(const Duration(milliseconds: 50));
    expect(received, hasLength(1));
    expect((received.first as Map)['message'], 'hi');

    unsubscribe();
    socket.add(
      jsonEncode({
        'jsonrpc': '2.0',
        'method': 'echo',
        'params': {'sessionId': 's1', 'message': 'ignored', 'ts': 'now'},
      }),
    );
    await Future<void>.delayed(const Duration(milliseconds: 50));
    expect(received, hasLength(1));

    client.close();
  });

  test('closing rejects pending requests', () async {
    final client = WsClient('ws://127.0.0.1:${server.port}/ws');
    await client.connect();
    await server.waitForSocket();

    final pending = client.request<void>('never.responds', {});
    client.close();

    await expectLater(pending, throwsA(isA<StateError>()));
  });

  test('request() after close() rejects immediately', () async {
    final client = WsClient('ws://127.0.0.1:${server.port}/ws');
    await client.connect();
    await server.waitForSocket();
    client.close();

    await expectLater(
      client.request<void>('anything', {}),
      throwsA(isA<StateError>()),
    );
  });
}
