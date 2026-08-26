import 'package:flutter/material.dart';

import 'mascot_base.dart';

class ThinkingState extends StatefulWidget {
  const ThinkingState({super.key});

  @override
  State<ThinkingState> createState() => ThinkingStateState();
}

class ThinkingStateState extends State<ThinkingState>
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
        final dotCount = 1 + (t * 3).floor() % 3;
        return Stack(
          alignment: Alignment.center,
          children: [
            Positioned(
              top: 0,
              child: Opacity(
                opacity: 0.5 + 0.5 * (0.5 + 0.5 * (1 - (2 * t - 1).abs())),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey.shade300),
                  ),
                  child: Text('.' * dotCount),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 40),
              child: RobotBody(sway: t, eyeGlow: 0.6 + 0.4 * t),
            ),
          ],
        );
      },
    );
  }
}
