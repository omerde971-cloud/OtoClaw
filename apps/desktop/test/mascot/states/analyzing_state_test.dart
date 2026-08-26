import 'package:desktop/mascot/states/analyzing_state.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets(
    'AnalyzingState pumps without crashing and animates continuously',
    (tester) async {
      await tester.pumpWidget(
        const Directionality(
          textDirection: TextDirection.ltr,
          child: AnalyzingState(),
        ),
      );
      await tester.pump();

      final state = tester.state<AnalyzingStateState>(
        find.byType(AnalyzingState),
      );
      expect(state.controller.isAnimating, isTrue);

      await tester.pump(const Duration(milliseconds: 500));
      expect(state.controller.isAnimating, isTrue);
      expect(find.byType(AnalyzingState), findsOneWidget);
    },
  );
}
