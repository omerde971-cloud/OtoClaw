import 'package:flutter/material.dart';

import 'mascot_base.dart';

class CodingState extends StatefulWidget {
  const CodingState({super.key});

  @override
  State<CodingState> createState() => CodingStateState();
}

class CodingStateState extends State<CodingState>
    with SingleTickerProviderStateMixin {
  late final AnimationController controller;

  @override
  void initState() {
    super.initState();
    controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
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
        final typing = (t * 8).floor().isEven;
        return Stack(
          alignment: Alignment.center,
          children: [
            Positioned(
              top: 0,
              child: Container(
                width: 70,
                height: 40,
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E1E24),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(3, (i) {
                    final width = 10 + ((t * 3 + i) % 1) * 40;
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      child: Container(
                        width: width,
                        height: 3,
                        color: const Color(0xFF7CFF9E),
                      ),
                    );
                  }),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 46),
              child: RobotBody(
                sway: t,
                armLift: typing ? 0.6 : -0.6,
                eyeGlow: 0.8,
              ),
            ),
          ],
        );
      },
    );
  }
}
