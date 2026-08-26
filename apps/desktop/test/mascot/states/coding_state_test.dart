import 'package:desktop/mascot/states/coding_state.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('CodingState pumps without crashing and animates continuously', (
    tester,
  ) async {
    await tester.pumpWidget(
      const Directionality(
        textDirection: TextDirection.ltr,
        child: CodingState(),
      ),
    );
    await tester.pump();

    final state = tester.state<CodingStateState>(find.byType(CodingState));
    expect(state.controller.isAnimating, isTrue);

    await tester.pump(const Duration(milliseconds: 500));
    expect(state.controller.isAnimating, isTrue);
    expect(find.byType(CodingState), findsOneWidget);
  });
}
