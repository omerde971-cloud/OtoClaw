import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

/// Minimal JSON-RPC/WS client: id-correlated request/response plus
/// notification subscriptions. Mirrors packages/cli/src/wsClient.ts —
/// Phase 1 keeps this simple on purpose, no reconnect/retry logic.
class JsonRpcErrorLike {
  const JsonRpcErrorLike({required this.code, required this.message});

  final int code;
  final String message;
}

typedef Listener = void Function(Object? params);

class WsClient {
  WsClient(String url) : _channel = WebSocketChannel.connect(Uri.parse(url)) {
    _openCompleter = Completer<void>();
    _channel.ready
        .then((_) {
          if (!_openCompleter.isCompleted) _openCompleter.complete();
        })
        .catchError((Object err) {
          if (!_openCompleter.isCompleted) {
            _openCompleter.completeError(
              StateError('failed to connect to $url'),
            );
          }
        });
    _subscription = _channel.stream.listen(
      (event) => _handleMessage(event as String),
      onDone: _handleClose,
      onError: (Object _) => _handleClose(),
    );
  }

  final WebSocketChannel _channel;
  late final StreamSubscription<void> _subscription;
  late final Completer<void> _openCompleter;

  int _nextId = 1;
  final Map<int, Completer<Object?>> _pending = {};
  final Map<String, Set<Listener>> _listeners = {};
  bool _closed = false;

  Future<void> connect() => _openCompleter.future;

  Future<T> request<T>(String method, Object? params) {
    if (_closed) {
      return Future.error(StateError('connection is closed'));
    }
    final id = _nextId++;
    final completer = Completer<Object?>();
    _pending[id] = completer;
    _channel.sink.add(
      jsonEncode({'jsonrpc': '2.0', 'id': id, 'method': method, 'params': params}),
    );
    return completer.future.then((value) => value as T);
  }

  /// Subscribes to a notification method; returns an unsubscribe function.
  void Function() on(String method, Listener listener) {
    final set = _listeners.putIfAbsent(method, () => <Listener>{});
    set.add(listener);
    return () => set.remove(listener);
  }

  void close() {
    if (_closed) return;
    _handleClose();
    _subscription.cancel();
    _channel.sink.close();
  }

  void _handleMessage(String raw) {
    Map<String, dynamic> msg;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return;
      msg = Map<String, dynamic>.from(decoded);
    } catch (_) {
      return;
    }

    if (msg.containsKey('id') && msg['id'] != null) {
      final id = msg['id'];
      if (id is! int) return;
      final pending = _pending.remove(id);
      if (pending == null) return;
      if (msg['error'] != null) {
        final error = Map<String, dynamic>.from(msg['error'] as Map);
        pending.completeError(
          StateError(error['message'] as String? ?? 'unknown error'),
        );
      } else {
        pending.complete(msg['result']);
      }
      return;
    }

    final method = msg['method'];
    if (method is String) {
      final set = _listeners[method];
      if (set != null) {
        for (final listener in Set<Listener>.from(set)) {
          listener(msg['params']);
        }
      }
    }
  }

  void _handleClose() {
    _closed = true;
    for (final pending in _pending.values) {
      pending.completeError(StateError('connection closed'));
    }
    _pending.clear();
  }
}
