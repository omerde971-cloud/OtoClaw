import 'package:flutter/material.dart';

/// Shared cube-headed robot body used by every fallback state widget, per
/// OTOCLAW_PLAN.md §3: cream rounded cube head, glowing vertical-bar eyes,
/// antenna, dark stubby arms/legs. `sway` drives the continuous idle motion
/// (0..1, looped by the caller's AnimationController).
class RobotBody extends StatelessWidget {
  const RobotBody({
    super.key,
    required this.sway,
    this.eyeGlow = 1,
    this.armLift = 0,
  });

  final double sway;
  final double eyeGlow;
  final double armLift;

  @override
  Widget build(BuildContext context) {
    final tilt = (sway - 0.5) * 0.12;
    final bob = (sway - 0.5) * 6;
    return Transform.translate(
      offset: Offset(0, bob),
      child: Transform.rotate(
        angle: tilt,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 6,
              height: 14,
              decoration: BoxDecoration(
                color: Colors.grey.shade400,
                borderRadius: BorderRadius.circular(3),
              ),
            ),
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: const Color(0xFFF5F1E8),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.15),
                    blurRadius: 6,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _eye(eyeGlow),
                  const SizedBox(width: 10),
                  _eye(eyeGlow),
                ],
              ),
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _limb(armLift),
                const SizedBox(width: 28),
                _limb(-armLift),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _eye(double glow) {
    return Container(
      width: 8,
      height: 20,
      decoration: BoxDecoration(
        color: Color.lerp(
          const Color(0xFF5CD6FF),
          const Color(0xFFB8F0FF),
          glow,
        ),
        borderRadius: BorderRadius.circular(4),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF5CD6FF).withValues(alpha: 0.6 * glow),
            blurRadius: 8 * glow,
            spreadRadius: 1,
          ),
        ],
      ),
    );
  }

  Widget _limb(double lift) {
    return Transform.rotate(
      angle: lift * 0.3,
      child: Container(
        width: 10,
        height: 20,
        decoration: BoxDecoration(
          color: const Color(0xFF2E2E33),
          borderRadius: BorderRadius.circular(4),
        ),
      ),
    );
  }
}
