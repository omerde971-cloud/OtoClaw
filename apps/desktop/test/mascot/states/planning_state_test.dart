import 'package:desktop/mascot/states/planning_state.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets(
    'PlanningState pumps without crashing and animates continuously',
    (tester) async {
      await tester.pumpWidget(
        const Directionality(
          textDirection: TextDirection.ltr,
          child: PlanningState(),
        ),
      );
      await tester.pump();

      final state = tester.state<PlanningStateState>(
        find.byType(PlanningState),
      );
      expect(state.controller.isAnimating, isTrue);

      await tester.pump(const Duration(milliseconds: 500));
      expect(state.controller.isAnimating, isTrue);
      expect(find.byType(PlanningState), findsOneWidget);
    },
  );
}
