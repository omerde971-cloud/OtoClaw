import 'package:desktop/dialogs/question_dialog.dart';
import 'package:desktop/protocol/messages.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

const _options = [
  QuestionOptionPayload(id: 'opt-a', label: 'Option A'),
  QuestionOptionPayload(id: 'opt-b', label: 'Option B', description: 'the b one'),
];

QuestionAskPayload _payload({bool allowFreeText = false}) {
  return QuestionAskPayload(
    sessionId: 's1',
    questionId: 'q1',
    header: 'Pick one',
    question: 'Which do you want?',
    options: _options,
    allowFreeText: allowFreeText,
  );
}

Future<void> _pump(
  WidgetTester tester,
  QuestionAskPayload payload,
  void Function({String? optionId, String? freeText}) onAnswer,
) {
  return tester.pumpWidget(
    MaterialApp(
      home: QuestionDialog(payload: payload, onAnswer: onAnswer),
    ),
  );
}

void main() {
  testWidgets('shows header, question and every option', (tester) async {
    await _pump(tester, _payload(), ({optionId, freeText}) {});

    expect(find.text('Pick one'), findsOneWidget);
    expect(find.text('Which do you want?'), findsOneWidget);
    expect(find.text('Option A'), findsOneWidget);
    expect(find.text('Option B'), findsOneWidget);
  });

  testWidgets('tapping an option calls onAnswer with its optionId', (
    tester,
  ) async {
    String? capturedOptionId;
    await _pump(tester, _payload(), ({optionId, freeText}) {
      capturedOptionId = optionId;
    });

    await tester.tap(find.text('Option B'));
    await tester.pumpAndSettle();

    expect(capturedOptionId, 'opt-b');
  });

  testWidgets('free text field is hidden when allowFreeText is false', (
    tester,
  ) async {
    await _pump(tester, _payload(), ({optionId, freeText}) {});

    expect(find.byType(TextField), findsNothing);
  });

  testWidgets('free text field is shown when allowFreeText is true', (
    tester,
  ) async {
    await _pump(tester, _payload(allowFreeText: true), ({
      optionId,
      freeText,
    }) {});

    expect(find.byType(TextField), findsOneWidget);
  });

  testWidgets('entering free text and submitting calls onAnswer with freeText', (
    tester,
  ) async {
    String? capturedFreeText;
    await _pump(tester, _payload(allowFreeText: true), ({
      optionId,
      freeText,
    }) {
      capturedFreeText = freeText;
    });

    await tester.enterText(find.byType(TextField), 'my custom answer');
    await tester.tap(find.text('Submit'));
    await tester.pumpAndSettle();

    expect(capturedFreeText, 'my custom answer');
  });
}
