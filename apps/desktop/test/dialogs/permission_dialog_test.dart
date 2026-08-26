import 'package:desktop/dialogs/permission_dialog.dart';
import 'package:desktop/protocol/messages.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

const _payload = PermissionRequestPayload(
  sessionId: 's1',
  requestId: 'r1',
  tool: 'shell.run',
  args: {'cmd': 'rm -rf /'},
  risk: PermissionRisk(score: 8, reasons: ['destructive command']),
);

Future<void> _pump(WidgetTester tester, void Function(String) onDecision) {
  return tester.pumpWidget(
    MaterialApp(
      home: PermissionDialog(payload: _payload, onDecision: onDecision),
    ),
  );
}

void main() {
  testWidgets('shows all four decision options', (tester) async {
    await _pump(tester, (_) {});

    expect(find.text('Allow once'), findsOneWidget);
    expect(find.text('Deny once'), findsOneWidget);
    expect(find.text('Always allow'), findsOneWidget);
    expect(find.text('Never allow'), findsOneWidget);
    expect(find.textContaining('shell.run'), findsOneWidget);
    expect(find.text('destructive command'), findsOneWidget);
  });

  testWidgets('tapping "Allow once" calls onDecision with "allow"', (
    tester,
  ) async {
    String? decision;
    await _pump(tester, (d) => decision = d);

    await tester.tap(find.text('Allow once'));
    await tester.pumpAndSettle();

    expect(decision, 'allow');
  });

  testWidgets('tapping "Deny once" calls onDecision with "deny"', (
    tester,
  ) async {
    String? decision;
    await _pump(tester, (d) => decision = d);

    await tester.tap(find.text('Deny once'));
    await tester.pumpAndSettle();

    expect(decision, 'deny');
  });

  testWidgets('tapping "Always allow" calls onDecision with "always"', (
    tester,
  ) async {
    String? decision;
    await _pump(tester, (d) => decision = d);

    await tester.tap(find.text('Always allow'));
    await tester.pumpAndSettle();

    expect(decision, 'always');
  });

  testWidgets('tapping "Never allow" calls onDecision with "never"', (
    tester,
  ) async {
    String? decision;
    await _pump(tester, (d) => decision = d);

    await tester.tap(find.text('Never allow'));
    await tester.pumpAndSettle();

    expect(decision, 'never');
  });
}
