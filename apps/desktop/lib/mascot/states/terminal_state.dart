import 'package:flutter/material.dart';

import 'mascot_base.dart';

class TerminalState extends StatefulWidget {
  const TerminalState({super.key});

  @override
  State<TerminalState> createState() => TerminalStateState();
}

class TerminalStateState extends State<TerminalState>
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
        return Stack(
          alignment: Alignment.center,
          children: [
            Positioned(
              top: 0,
              child: ClipRect(
                child: Container(
                  width: 70,
                  height: 36,
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: Colors.black,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: OverflowBox(
                    minHeight: 0,
                    maxHeight: double.infinity,
                    alignment: Alignment.topLeft,
                    child: Transform.translate(
                      offset: Offset(0, -t * 40),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: List.generate(6, (i) {
                          return Text(
                            '> otoclaw ${i + 1}',
                            style: const TextStyle(
                              color: Color(0xFF7CFF9E),
                              fontSize: 6,
                              fontFamily: 'monospace',
                            ),
                          );
                        }),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 42),
              child: RobotBody(sway: t, eyeGlow: 0.9),
            ),
          ],
        );
      },
    );
  }
}
