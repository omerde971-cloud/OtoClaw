import 'dart:async';

import 'package:desktop/mascot/fallback_mascot_renderer.dart';
import 'package:desktop/mascot/mascot_widget.dart';
import 'package:desktop/mascot/states/analyzing_state.dart';
import 'package:desktop/mascot/states/building_state.dart';
import 'package:desktop/mascot/states/coding_state.dart';
import 'package:desktop/mascot/states/done_state.dart';
import 'package:desktop/mascot/states/idle_state.dart';
import 'package:desktop/mascot/states/planning_state.dart';
import 'package:desktop/mascot/states/presenting_state.dart';
import 'package:desktop/mascot/states/terminal_state.dart';
import 'package:desktop/mascot/states/thinking_state.dart';
import 'package:desktop/mascot/states/tool_state.dart';
import 'package:desktop/mascot/states/waiting_state.dart';
import 'package:desktop/protocol/messages.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> _emitAndSettleSwitch(
  WidgetTester tester,
  StreamController<MascotStatePayload> controller,
  MascotStatePayload payload,
) async {
  controller.add(payload);
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 300));
}

MascotStatePayload _payload(String state) => MascotStatePayload(
  sessionId: 's1',
  state: state,
  since: '2026-08-26T00:00:00.000Z',
);

void main() {
  testWidgets('pumps each of the 10 wire states to the matching widget', (
    tester,
  ) async {
    final controller = StreamController<MascotStatePayload>.broadcast();
    addTearDown(controller.close);

    await tester.pumpWidget(
      Directionality(
        textDirection: TextDirection.ltr,
        child: MascotWidget(
          stateStream: controller.stream,
          renderer: FallbackMascotRenderer(),
        ),
      ),
    );
    await tester.pump();

    expect(find.byType(IdleState), findsOneWidget);

    final cases = <String, Type>{
      'thinking': ThinkingState,
      'coding': CodingState,
      'analyzing': AnalyzingState,
      'planning': PlanningState,
      'building': BuildingState,
      'terminal': TerminalState,
      'tool': ToolState,
      'waiting': WaitingState,
      'done': DoneState,
      'presenting': PresentingState,
    };

    for (final entry in cases.entries) {
      await _emitAndSettleSwitch(tester, controller, _payload(entry.key));
      expect(find.byType(entry.value), findsOneWidget);
    }
  });

  testWidgets('unknown wire state falls back to idle without crashing', (
    tester,
  ) async {
    final controller = StreamController<MascotStatePayload>.broadcast();
    addTearDown(controller.close);

    await tester.pumpWidget(
      Directionality(
        textDirection: TextDirection.ltr,
        child: MascotWidget(
          stateStream: controller.stream,
          renderer: FallbackMascotRenderer(),
        ),
      ),
    );
    await tester.pump();

    await _emitAndSettleSwitch(tester, controller, _payload('thinking'));
    expect(find.byType(ThinkingState), findsOneWidget);

    await _emitAndSettleSwitch(tester, controller, _payload('not-a-state'));
    expect(find.byType(IdleState), findsOneWidget);
  });

  testWidgets('state change swaps the widget tree via AnimatedSwitcher', (
    tester,
  ) async {
    final controller = StreamController<MascotStatePayload>.broadcast();
    addTearDown(controller.close);

    await tester.pumpWidget(
      Directionality(
        textDirection: TextDirection.ltr,
        child: MascotWidget(
          stateStream: controller.stream,
          renderer: FallbackMascotRenderer(),
        ),
      ),
    );
    await tester.pump();
    expect(find.byType(IdleState), findsOneWidget);

    await _emitAndSettleSwitch(tester, controller, _payload('coding'));
    expect(find.byType(IdleState), findsNothing);
    expect(find.byType(CodingState), findsOneWidget);
  });
}
