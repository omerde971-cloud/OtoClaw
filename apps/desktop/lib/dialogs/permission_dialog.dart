import 'package:flutter/material.dart';

import '../protocol/messages.dart';

class _PermissionOption {
  const _PermissionOption(this.decision, this.label);

  final String decision;
  final String label;
}

const _options = [
  _PermissionOption('allow', 'Allow once'),
  _PermissionOption('deny', 'Deny once'),
  _PermissionOption('always', 'Always allow'),
  _PermissionOption('never', 'Never allow'),
];

/// AlertDialog for a PermissionRequestPayload. onDecision is called with one
/// of "allow" | "deny" | "always" | "never" (PermissionDecisionValue).
class PermissionDialog extends StatelessWidget {
  const PermissionDialog({
    super.key,
    required this.payload,
    required this.onDecision,
  });

  final PermissionRequestPayload payload;
  final void Function(String decision) onDecision;

  static Future<void> show(
    BuildContext context,
    PermissionRequestPayload payload,
    void Function(String decision) onDecision,
  ) {
    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => PermissionDialog(payload: payload, onDecision: onDecision),
    );
  }

  void _respond(BuildContext context, String decision) {
    Navigator.of(context).pop();
    onDecision(decision);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('Permission requested: ${payload.tool}'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Risk score: ${payload.risk.score}'),
          if (payload.risk.reasons.isNotEmpty)
            Text(payload.risk.reasons.join(', ')),
        ],
      ),
      actions: [
        for (final option in _options)
          TextButton(
            onPressed: () => _respond(context, option.decision),
            child: Text(option.label),
          ),
      ],
    );
  }
}
