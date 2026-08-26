import 'package:flutter/material.dart';

import 'mascot_base.dart';

class ToolState extends StatefulWidget {
  const ToolState({super.key});

  @override
  State<ToolState> createState() => ToolStateState();
}

class ToolStateState extends State<ToolState>
    with SingleTickerProviderStateMixin {
  late final AnimationController controller;

  @override
  void initState() {
    super.initState();
    controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
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
        final pulse = 0.6 + 0.4 * (0.5 - 0.5 * (2 * t - 1).abs() * 2).clamp(
          0.0,
          1.0,
        );
        return Stack(
          alignment: Alignment.center,
          children: [
            Positioned(
              top: 4,
              child: Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  color: const Color(0xFFFFD35C).withValues(alpha: pulse),
                  borderRadius: BorderRadius.circular(5),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(
                        0xFFFFD35C,
                      ).withValues(alpha: 0.6 * pulse),
                      blurRadius: 10 * pulse,
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.build,
                  size: 14,
                  color: Color(0xFF2E2E33),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 34),
              child: RobotBody(sway: t, eyeGlow: 0.7, armLift: 0.5),
            ),
          ],
        );
      },
    );
  }
}
