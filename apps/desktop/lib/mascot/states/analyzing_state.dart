import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'mascot_base.dart';

class AnalyzingState extends StatefulWidget {
  const AnalyzingState({super.key});

  @override
  State<AnalyzingState> createState() => AnalyzingStateState();
}

class AnalyzingStateState extends State<AnalyzingState>
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
        final angle = t * 2 * math.pi;
        final dx = 18 * math.cos(angle);
        final dy = 6 * math.sin(angle);
        return Stack(
          alignment: Alignment.center,
          children: [
            Positioned(
              top: 0,
              right: 0,
              child: Opacity(
                opacity: 0.6 + 0.4 * (0.5 + 0.5 * math.sin(angle * 2)),
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.grey.shade400),
                  ),
                  child: const Text('?'),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 30),
              child: RobotBody(sway: t, eyeGlow: 0.7),
            ),
            Positioned(
              top: 20,
              child: Transform.translate(
                offset: Offset(dx, dy),
                child: Transform.rotate(
                  angle: -0.5,
                  child: Icon(
                    Icons.search,
                    size: 26,
                    color: Colors.grey.shade700,
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
