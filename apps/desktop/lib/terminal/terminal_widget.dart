import 'dart:async';

import 'package:flutter/material.dart';
import 'package:xterm/xterm.dart';

import '../protocol/messages.dart';

const _shellRunTool = 'shell.run';

/// Read-only terminal fed by tool.start/tool.end notification streams.
///
/// packages/tools/src/shell.ts's shell.run does not stream stdout/stderr
/// live — it returns the full result only with tool.end — so this widget
/// never renders partial/character-by-character output; each shell.run call
/// produces exactly one `$ <cmd>` write (from tool.start) followed later by
/// one stdout/stderr write (from tool.end).
class TerminalWidget extends StatefulWidget {
  const TerminalWidget({super.key, this.toolStart, this.toolEnd});

  final Stream<ToolStartPayload>? toolStart;
  final Stream<ToolEndPayload>? toolEnd;

  @override
  State<TerminalWidget> createState() => TerminalWidgetState();
}

class TerminalWidgetState extends State<TerminalWidget> {
  final Terminal terminal = Terminal(maxLines: 10000);

  StreamSubscription<ToolStartPayload>? _startSub;
  StreamSubscription<ToolEndPayload>? _endSub;

  @override
  void initState() {
    super.initState();
    _startSub = widget.toolStart?.listen(_onToolStart);
    _endSub = widget.toolEnd?.listen(_onToolEnd);
  }

  @override
  void didUpdateWidget(covariant TerminalWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.toolStart != widget.toolStart) {
      _startSub?.cancel();
      _startSub = widget.toolStart?.listen(_onToolStart);
    }
    if (oldWidget.toolEnd != widget.toolEnd) {
      _endSub?.cancel();
      _endSub = widget.toolEnd?.listen(_onToolEnd);
    }
  }

  @override
  void dispose() {
    _startSub?.cancel();
    _endSub?.cancel();
    super.dispose();
  }

  void _onToolStart(ToolStartPayload payload) {
    if (payload.name != _shellRunTool) return;
    final args = payload.args;
    if (args is Map) {
      final cmd = args['cmd'];
      if (cmd is String) {
        _writeLine('\$ $cmd');
      }
    }
  }

  void _onToolEnd(ToolEndPayload payload) {
    if (payload.name != _shellRunTool) return;
    final result = payload.result;
    if (result is! Map) return;

    final stdout = result['stdout'];
    if (stdout is String && stdout.isNotEmpty) {
      _writeBlock(stdout);
    }

    final stderr = result['stderr'];
    if (stderr is String && stderr.isNotEmpty) {
      _writeBlock('\x1B[31m$stderr\x1B[0m');
    }

    final exitCode = result['exitCode'];
    if (exitCode is int && exitCode != 0) {
      _writeLine('\x1B[31mexit $exitCode\x1B[0m');
    }
  }

  void _writeLine(String text) => terminal.write('$text\r\n');

  void _writeBlock(String text) {
    final normalized = text.replaceAll(RegExp(r'\r?\n'), '\r\n');
    terminal.write(normalized);
    if (!normalized.endsWith('\r\n')) terminal.write('\r\n');
  }

  @override
  Widget build(BuildContext context) {
    return TerminalView(terminal, readOnly: true);
  }
}
