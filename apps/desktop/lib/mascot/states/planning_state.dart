import 'package:flutter/material.dart';

import 'mascot_base.dart';

class PlanningState extends StatefulWidget {
  const PlanningState({super.key});

  @override
  State<PlanningState> createState() => PlanningStateState();
}

class PlanningStateState extends State<PlanningState>
    with SingleTickerProviderStateMixin {
  late final AnimationController controller;
  static const _itemCount = 4;

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
        final activeCount = 1 + (t * _itemCount).floor() % _itemCount;
        return Stack(
          alignment: Alignment.center,
          children: [
            Positioned(
              top: 0,
              child: Container(
                width: 68,
                padding: const EdgeInsets.symmetric(
                  horizontal: 8,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: List.generate(_itemCount, (i) {
                    final checked = i < activeCount;
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      child: Row(
                        children: [
                          Icon(
                            checked
                                ? Icons.check_box
                                : Icons.check_box_outline_blank,
                            size: 10,
                            color: checked ? Colors.green : Colors.grey,
                          ),
                          const SizedBox(width: 4),
                          Container(
                            width: 30,
                            height: 3,
                            color: Colors.grey.shade300,
                          ),
                        ],
                      ),
                    );
                  }),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 76),
              child: RobotBody(sway: t, eyeGlow: 0.7),
            ),
          ],
        );
      },
    );
  }
}
