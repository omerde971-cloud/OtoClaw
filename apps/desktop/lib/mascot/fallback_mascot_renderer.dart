import 'package:flutter/widgets.dart';

import 'mascot_renderer.dart';
import 'mascot_state.dart';
import 'states/analyzing_state.dart';
import 'states/building_state.dart';
import 'states/coding_state.dart';
import 'states/done_state.dart';
import 'states/idle_state.dart';
import 'states/planning_state.dart';
import 'states/presenting_state.dart';
import 'states/terminal_state.dart';
import 'states/thinking_state.dart';
import 'states/tool_state.dart';
import 'states/waiting_state.dart';

/// Renders each [MascotStateName] with a Flutter-native, continuously
/// animated widget (no Rive asset required).
class FallbackMascotRenderer implements MascotRenderer {
  @override
  Widget build(BuildContext context, MascotStateName state) {
    switch (state) {
      case MascotStateName.idle:
        return const IdleState();
      case MascotStateName.thinking:
        return const ThinkingState();
      case MascotStateName.coding:
        return const CodingState();
      case MascotStateName.analyzing:
        return const AnalyzingState();
      case MascotStateName.planning:
        return const PlanningState();
      case MascotStateName.building:
        return const BuildingState();
      case MascotStateName.terminal:
        return const TerminalState();
      case MascotStateName.tool:
        return const ToolState();
      case MascotStateName.waiting:
        return const WaitingState();
      case MascotStateName.done:
        return const DoneState();
      case MascotStateName.presenting:
        return const PresentingState();
    }
  }
}
