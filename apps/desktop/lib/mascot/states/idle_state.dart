import 'package:flutter/material.dart';

import 'mascot_base.dart';

class IdleState extends StatefulWidget {
  const IdleState({super.key});

  @override
  State<IdleState> createState() => IdleStateState();
}

class IdleStateState extends State<IdleState>
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
        return RobotBody(sway: controller.value, eyeGlow: 0.5);
      },
    );
  }
}
