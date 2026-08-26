import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'mascot_base.dart';

class DoneState extends StatefulWidget {
  const DoneState({super.key});

  @override
  State<DoneState> createState() => DoneStateState();
}

class DoneStateState extends State<DoneState>
    with SingleTickerProviderStateMixin {
  late final AnimationController controller;
  static const _sparkleCount = 6;

  @override
  void initState() {
    super.initState();
    controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
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
        final popScale = t < 0.3
            ? (t / 0.3)
            : 1.0 - 0.05 * math.sin((t - 0.3) * math.pi);
        return Stack(
          alignment: Alignment.center,
          children: [
            Positioned(
              top: 0,
              child: SizedBox(
                width: 60,
                height: 40,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    for (var i = 0; i < _sparkleCount; i++)
                      _sparkle(i, t),
                    Transform.scale(
                      scale: popScale.clamp(0.0, 1.2),
                      child: const Icon(
                        Icons.check_circle,
                        color: Colors.green,
                        size: 26,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 46),
              child: RobotBody(sway: t, eyeGlow: 1, armLift: 0.8),
            ),
          ],
        );
      },
    );
  }

  Widget _sparkle(int index, double t) {
    final angle = (index / _sparkleCount) * 2 * math.pi;
    final radius = 24 * t;
    final opacity = (1 - t).clamp(0.0, 1.0);
    return Opacity(
      opacity: opacity,
      child: Transform.translate(
        offset: Offset(radius * math.cos(angle), radius * math.sin(angle)),
        child: const Icon(Icons.star, size: 8, color: Color(0xFFFFD35C)),
      ),
    );
  }
}
