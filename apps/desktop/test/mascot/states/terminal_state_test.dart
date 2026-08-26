import 'package:desktop/mascot/states/terminal_state.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets(
    'TerminalState pumps without crashing and animates continuously',
    (tester) async {
      await tester.pumpWidget(
        const Directionality(
          textDirection: TextDirection.ltr,
          child: TerminalState(),
        ),
      );
      await tester.pump();

      final state = tester.state<TerminalStateState>(
        find.byType(TerminalState),
      );
      expect(state.controller.isAnimating, isTrue);

      await tester.pump(const Duration(milliseconds: 500));
      expect(state.controller.isAnimating, isTrue);
      expect(find.byType(TerminalState), findsOneWidget);
    },
  );
}
