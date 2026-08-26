import 'package:desktop/mascot/states/presenting_state.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets(
    'PresentingState pumps without crashing and animates continuously',
    (tester) async {
      await tester.pumpWidget(
        const Directionality(
          textDirection: TextDirection.ltr,
          child: PresentingState(),
        ),
      );
      await tester.pump();

      final state = tester.state<PresentingStateState>(
        find.byType(PresentingState),
      );
      expect(state.controller.isAnimating, isTrue);

      await tester.pump(const Duration(milliseconds: 500));
      expect(state.controller.isAnimating, isTrue);
      expect(find.byType(PresentingState), findsOneWidget);
    },
  );
}
