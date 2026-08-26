import 'package:desktop/mascot/states/thinking_state.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('ThinkingState pumps without crashing and animates continuously', (
    tester,
  ) async {
    await tester.pumpWidget(
      const Directionality(
        textDirection: TextDirection.ltr,
        child: ThinkingState(),
      ),
    );
    await tester.pump();

    final state = tester.state<ThinkingStateState>(
      find.byType(ThinkingState),
    );
    expect(state.controller.isAnimating, isTrue);

    await tester.pump(const Duration(milliseconds: 500));
    expect(state.controller.isAnimating, isTrue);
    expect(find.byType(ThinkingState), findsOneWidget);
  });
}
