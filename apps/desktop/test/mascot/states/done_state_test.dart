import 'package:desktop/mascot/states/done_state.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('DoneState pumps without crashing and animates continuously', (
    tester,
  ) async {
    await tester.pumpWidget(
      const Directionality(
        textDirection: TextDirection.ltr,
        child: DoneState(),
      ),
    );
    await tester.pump();

    final state = tester.state<DoneStateState>(find.byType(DoneState));
    expect(state.controller.isAnimating, isTrue);

    await tester.pump(const Duration(milliseconds: 500));
    expect(state.controller.isAnimating, isTrue);
    expect(find.byType(DoneState), findsOneWidget);
  });
}
