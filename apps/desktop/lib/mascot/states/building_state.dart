import 'package:flutter/material.dart';

import 'mascot_base.dart';

class BuildingState extends StatefulWidget {
  const BuildingState({super.key});

  @override
  State<BuildingState> createState() => BuildingStateState();
}

class BuildingStateState extends State<BuildingState>
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
              child: SizedBox(
                width: 70,
                height: 40,
                child: CustomPaint(painter: _NodeDiagramPainter(progress: t)),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 46),
              child: RobotBody(sway: t, eyeGlow: 0.7),
            ),
          ],
        );
      },
    );
  }
}

class _NodeDiagramPainter extends CustomPainter {
  _NodeDiagramPainter({required this.progress});

  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final nodePaint = Paint()..color = const Color(0xFF5CD6FF);
    final linePaint = Paint()
      ..color = const Color(0xFF5CD6FF)
      ..strokeWidth = 2;

    final nodes = [
      Offset(4, size.height / 2),
      Offset(size.width / 2, 4),
      Offset(size.width / 2, size.height - 4),
      Offset(size.width - 4, size.height / 2),
    ];

    final segments = [
      [nodes[0], nodes[1]],
      [nodes[0], nodes[2]],
      [nodes[1], nodes[3]],
      [nodes[2], nodes[3]],
    ];

    final cycle = (progress * segments.length) % segments.length;
    for (var i = 0; i < segments.length; i++) {
      final segProgress = (cycle - i).clamp(0.0, 1.0);
      if (segProgress <= 0) continue;
      final from = segments[i][0];
      final to = segments[i][1];
      final end = Offset.lerp(from, to, segProgress)!;
      canvas.drawLine(from, end, linePaint);
    }

    for (final node in nodes) {
      canvas.drawCircle(node, 4, nodePaint);
    }
  }

  @override
  bool shouldRepaint(covariant _NodeDiagramPainter oldDelegate) =>
      oldDelegate.progress != progress;
}
