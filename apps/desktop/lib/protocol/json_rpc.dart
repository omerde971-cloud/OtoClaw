/// JSON-RPC 2.0 envelope classes mirroring packages/shared/src/protocol.ts.
library;

class JsonRpcError {
  const JsonRpcError({required this.code, required this.message, this.data});

  final int code;
  final String message;
  final Object? data;

  factory JsonRpcError.fromJson(Map<String, dynamic> json) {
    return JsonRpcError(
      code: json['code'] as int,
      message: json['message'] as String,
      data: json['data'],
    );
  }

  Map<String, dynamic> toJson() => {
    'code': code,
    'message': message,
    if (data != null) 'data': data,
  };
}

class JsonRpcRequest {
  const JsonRpcRequest({
    required this.id,
    required this.method,
    required this.params,
  });

  final Object id; // int or String
  final String method;
  final Object? params;

  factory JsonRpcRequest.fromJson(Map<String, dynamic> json) {
    return JsonRpcRequest(
      id: json['id'] as Object,
      method: json['method'] as String,
      params: json['params'],
    );
  }

  Map<String, dynamic> toJson() => {
    'jsonrpc': '2.0',
    'id': id,
    'method': method,
    'params': params,
  };
}

class JsonRpcResponse {
  const JsonRpcResponse({required this.id, this.result, this.error});

  final Object id; // int or String
  final Object? result;
  final JsonRpcError? error;

  factory JsonRpcResponse.fromJson(Map<String, dynamic> json) {
    return JsonRpcResponse(
      id: json['id'] as Object,
      result: json['result'],
      error: json['error'] != null
          ? JsonRpcError.fromJson(json['error'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'jsonrpc': '2.0',
    'id': id,
    if (result != null) 'result': result,
    if (error != null) 'error': error!.toJson(),
  };
}

class JsonRpcNotification {
  const JsonRpcNotification({required this.method, required this.params});

  final String method;
  final Object? params;

  factory JsonRpcNotification.fromJson(Map<String, dynamic> json) {
    return JsonRpcNotification(
      method: json['method'] as String,
      params: json['params'],
    );
  }

  Map<String, dynamic> toJson() => {
    'jsonrpc': '2.0',
    'method': method,
    'params': params,
  };
}
