import 'package:flutter/material.dart';

import 'mascot_base.dart';

class WaitingState extends StatefulWidget {
  const WaitingState({super.key});

  @override
  State<WaitingState> createState() => WaitingStateState();
}

class WaitingStateState extends State<WaitingState>
    with SingleTickerProviderStateMixin {
  late final AnimationController controller;

  @override
  void initState() {
    super.initState();
    controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final t = controller.value;
        final glow = 0.4 + 0.6 * (0.5 + 0.5 * (1 - (2 * t - 1).abs()));
        return Stack(
          alignment: Alignment.center,
          children: [
            Positioned(
              top: 0,
              child: Icon(
                Icons.shield,
                size: 28,
                color: Color.lerp(
                  const Color(0xFFB8860B),
                  const Color(0xFFFFE08A),
                  glow,
                ),
                shadows: [
                  Shadow(
                    color: const Color(0xFFFFE08A).withValues(alpha: glow),
                    blurRadius: 10 * glow,
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 36),
              child: RobotBody(sway: 0.5, eyeGlow: glow, armLift: 0.1),
            ),
          ],
        );
      },
    );
  }
}
