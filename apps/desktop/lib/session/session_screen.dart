import 'dart:async';

import 'package:flutter/material.dart';

import '../daemon/ws_client.dart';
import '../dialogs/permission_dialog.dart';
import '../dialogs/question_dialog.dart';
import '../protocol/messages.dart';
import '../terminal/terminal_widget.dart';

/// Wires a daemon session's tool.start/tool.end notifications into the
/// terminal, and its permission.request/question.ask notifications into
/// modal dialogs. Mascot/panel widgets (3b) are integrated separately by the
/// CEO once that parallel work lands — this screen is complete without them.
class SessionScreen extends StatefulWidget {
  const SessionScreen({super.key, required this.client, this.sessionId});

  final WsClient client;

  /// When set, notifications for other sessions are ignored.
  final String? sessionId;

  @override
  State<SessionScreen> createState() => SessionScreenState();
}

class SessionScreenState extends State<SessionScreen> {
  final _toolStartController = StreamController<ToolStartPayload>.broadcast();
  final _toolEndController = StreamController<ToolEndPayload>.broadcast();

  void Function()? _unsubToolStart;
  void Function()? _unsubToolEnd;
  void Function()? _unsubPermission;
  void Function()? _unsubQuestion;

  @override
  void initState() {
    super.initState();
    _unsubToolStart = widget.client.on('tool.start', _onToolStart);
    _unsubToolEnd = widget.client.on('tool.end', _onToolEnd);
    _unsubPermission = widget.client.on(
      'permission.request',
      _onPermissionRequest,
    );
    _unsubQuestion = widget.client.on('question.ask', _onQuestionAsk);
  }

  @override
  void dispose() {
    _unsubToolStart?.call();
    _unsubToolEnd?.call();
    _unsubPermission?.call();
    _unsubQuestion?.call();
    _toolStartController.close();
    _toolEndController.close();
    super.dispose();
  }

  bool _forThisSession(String sessionId) =>
      widget.sessionId == null || widget.sessionId == sessionId;

  Map<String, dynamic> _asMap(Object? value) =>
      Map<String, dynamic>.from(value as Map);

  void _onToolStart(Object? params) {
    final payload = ToolStartPayload.fromJson(_asMap(params));
    if (_forThisSession(payload.sessionId)) _toolStartController.add(payload);
  }

  void _onToolEnd(Object? params) {
    final payload = ToolEndPayload.fromJson(_asMap(params));
    if (_forThisSession(payload.sessionId)) _toolEndController.add(payload);
  }

  void _onPermissionRequest(Object? params) {
    final payload = PermissionRequestPayload.fromJson(_asMap(params));
    if (!_forThisSession(payload.sessionId)) return;
    PermissionDialog.show(context, payload, (decision) {
      unawaited(
        widget.client.request<Object?>(
          'permission.respond',
          PermissionRespondParams(
            requestId: payload.requestId,
            decision: decision,
          ).toJson(),
        ),
      );
    });
  }

  void _onQuestionAsk(Object? params) {
    final payload = QuestionAskPayload.fromJson(_asMap(params));
    if (!_forThisSession(payload.sessionId)) return;
    QuestionDialog.show(context, payload, ({optionId, freeText}) {
      unawaited(
        widget.client.request<Object?>(
          'question.respond',
          QuestionRespondParams(
            questionId: payload.questionId,
            optionId: optionId,
            freeText: freeText,
          ).toJson(),
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: TerminalWidget(
        toolStart: _toolStartController.stream,
        toolEnd: _toolEndController.stream,
      ),
    );
  }
}
