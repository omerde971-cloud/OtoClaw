import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'mascot_base.dart';

class PresentingState extends StatefulWidget {
  const PresentingState({super.key});

  @override
  State<PresentingState> createState() => PresentingStateState();
}

class PresentingStateState extends State<PresentingState>
    with SingleTickerProviderStateMixin {
  late final AnimationController controller;

  @override
  void initState() {
    super.initState();
    controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
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
        return Stack(
          alignment: Alignment.center,
          children: [
            Positioned(
              top: 0,
              left: 4,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: const Icon(Icons.chat_bubble, size: 12),
              ),
            ),
            Positioned(
              top: 4,
              right: 4,
              child: Column(
                children: [
                  Opacity(
                    opacity: 0.5 + 0.5 * (0.5 + 0.5 * math.sin(t * 2 * math.pi)),
                    child: Transform.translate(
                      offset: Offset(0, -8 * t),
                      child: const Text('~', style: TextStyle(fontSize: 10)),
                    ),
                  ),
                  Container(
                    width: 14,
                    height: 10,
                    decoration: BoxDecoration(
                      color: const Color(0xFF8A5A2B),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 40),
              child: RobotBody(sway: t, eyeGlow: 0.8, armLift: 0.3),
            ),
          ],
        );
      },
    );
  }
}
