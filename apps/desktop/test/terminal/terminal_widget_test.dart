import 'dart:async';

import 'package:desktop/protocol/messages.dart';
import 'package:desktop/terminal/terminal_widget.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

String _bufferText(TerminalWidgetState state) {
  return state.terminal.buffer.lines
      .toList()
      .map((line) => line.toString())
      .join('\n');
}

void main() {
  testWidgets('tool.start for shell.run writes "\$ <cmd>"', (tester) async {
    final startController = StreamController<ToolStartPayload>.broadcast();
    final endController = StreamController<ToolEndPayload>.broadcast();
    final key = GlobalKey<TerminalWidgetState>();

    await tester.pumpWidget(
      MaterialApp(
        home: TerminalWidget(
          key: key,
          toolStart: startController.stream,
          toolEnd: endController.stream,
        ),
      ),
    );

    startController.add(
      const ToolStartPayload(
        sessionId: 's1',
        toolCallId: 't1',
        name: 'shell.run',
        args: {'cmd': 'echo hi'},
      ),
    );
    await tester.pump();

    expect(_bufferText(key.currentState!), contains(r'$ echo hi'));

    await startController.close();
    await endController.close();
  });

  testWidgets('tool.start for a non shell.run tool is ignored', (
    tester,
  ) async {
    final startController = StreamController<ToolStartPayload>.broadcast();
    final endController = StreamController<ToolEndPayload>.broadcast();
    final key = GlobalKey<TerminalWidgetState>();

    await tester.pumpWidget(
      MaterialApp(
        home: TerminalWidget(
          key: key,
          toolStart: startController.stream,
          toolEnd: endController.stream,
        ),
      ),
    );

    startController.add(
      const ToolStartPayload(
        sessionId: 's1',
        toolCallId: 't1',
        name: 'fs.read',
        args: {'path': '/tmp/x'},
      ),
    );
    await tester.pump();

    expect(_bufferText(key.currentState!).trim(), isEmpty);

    await startController.close();
    await endController.close();
  });

  testWidgets('tool.end for shell.run writes stdout lines', (tester) async {
    final startController = StreamController<ToolStartPayload>.broadcast();
    final endController = StreamController<ToolEndPayload>.broadcast();
    final key = GlobalKey<TerminalWidgetState>();

    await tester.pumpWidget(
      MaterialApp(
        home: TerminalWidget(
          key: key,
          toolStart: startController.stream,
          toolEnd: endController.stream,
        ),
      ),
    );

    endController.add(
      const ToolEndPayload(
        sessionId: 's1',
        toolCallId: 't1',
        name: 'shell.run',
        result: {
          'stdout': 'line one\nline two\n',
          'stderr': '',
          'exitCode': 0,
          'timedOut': false,
        },
      ),
    );
    await tester.pump();

    final text = _bufferText(key.currentState!);
    expect(text, contains('line one'));
    expect(text, contains('line two'));
    expect(text, isNot(contains('exit')));

    await startController.close();
    await endController.close();
  });

  testWidgets('tool.end with non-zero exitCode writes an exit summary', (
    tester,
  ) async {
    final startController = StreamController<ToolStartPayload>.broadcast();
    final endController = StreamController<ToolEndPayload>.broadcast();
    final key = GlobalKey<TerminalWidgetState>();

    await tester.pumpWidget(
      MaterialApp(
        home: TerminalWidget(
          key: key,
          toolStart: startController.stream,
          toolEnd: endController.stream,
        ),
      ),
    );

    endController.add(
      const ToolEndPayload(
        sessionId: 's1',
        toolCallId: 't1',
        name: 'shell.run',
        result: {
          'stdout': '',
          'stderr': 'boom',
          'exitCode': 1,
          'timedOut': false,
        },
      ),
    );
    await tester.pump();

    final text = _bufferText(key.currentState!);
    expect(text, contains('boom'));
    expect(text, contains('exit 1'));

    await startController.close();
    await endController.close();
  });
}
