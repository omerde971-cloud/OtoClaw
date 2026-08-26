import 'package:desktop/mascot/states/waiting_state.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets(
    'WaitingState pumps without crashing and animates continuously',
    (tester) async {
      await tester.pumpWidget(
        const Directionality(
          textDirection: TextDirection.ltr,
          child: WaitingState(),
        ),
      );
      await tester.pump();

      final state = tester.state<WaitingStateState>(
        find.byType(WaitingState),
      );
      expect(state.controller.isAnimating, isTrue);

      await tester.pump(const Duration(milliseconds: 500));
      expect(state.controller.isAnimating, isTrue);
      expect(find.byType(WaitingState), findsOneWidget);
    },
  );
}
