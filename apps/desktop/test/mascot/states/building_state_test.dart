import 'package:desktop/mascot/states/building_state.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets(
    'BuildingState pumps without crashing and animates continuously',
    (tester) async {
      await tester.pumpWidget(
        const Directionality(
          textDirection: TextDirection.ltr,
          child: BuildingState(),
        ),
      );
      await tester.pump();

      final state = tester.state<BuildingStateState>(
        find.byType(BuildingState),
      );
      expect(state.controller.isAnimating, isTrue);

      await tester.pump(const Duration(milliseconds: 500));
      expect(state.controller.isAnimating, isTrue);
      expect(find.byType(BuildingState), findsOneWidget);
    },
  );
}
