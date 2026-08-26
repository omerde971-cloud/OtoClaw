import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter/widgets.dart';
import 'package:rive/rive.dart';

import 'fallback_mascot_renderer.dart';
import 'mascot_renderer.dart';
import 'mascot_state.dart';

/// Loads `assets/rive/otoclaw.riv` and drives its state machine. When the
/// asset is missing or fails to parse, delegates to [fallback] — see
/// assets/rive/README.md for why the real .riv is not shipped yet.
class RiveMascotRenderer implements MascotRenderer {
  RiveMascotRenderer({
    this.assetPath = 'assets/rive/otoclaw.riv',
    this.stateMachineName = 'MascotStateMachine',
    MascotRenderer? fallback,
  }) : fallback = fallback ?? FallbackMascotRenderer();

  final String assetPath;
  final String stateMachineName;
  final MascotRenderer fallback;

  @override
  Widget build(BuildContext context, MascotStateName state) {
    return FutureBuilder<ByteData>(
      future: rootBundle.load(assetPath),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return fallback.build(context, state);
        }
        if (snapshot.hasError || !snapshot.hasData) {
          return fallback.build(context, state);
        }
        return _RiveStateMachineView(
          assetPath: assetPath,
          stateMachineName: stateMachineName,
          state: state,
          fallback: fallback,
        );
      },
    );
  }
}

class _RiveStateMachineView extends StatelessWidget {
  const _RiveStateMachineView({
    required this.assetPath,
    required this.stateMachineName,
    required this.state,
    required this.fallback,
  });

  final String assetPath;
  final String stateMachineName;
  final MascotStateName state;
  final MascotRenderer fallback;

  @override
  Widget build(BuildContext context) {
    try {
      return RiveAnimation.asset(
        assetPath,
        stateMachines: [stateMachineName],
        fit: BoxFit.contain,
        onInit: (artboard) {
          final controller = StateMachineController.fromArtboard(
            artboard,
            stateMachineName,
          );
          if (controller == null) return;
          artboard.addController(controller);
          final input = controller.findInput<double>('state');
          input?.value = state.index.toDouble();
        },
      );
    } catch (_) {
      return fallback.build(context, state);
    }
  }
}
