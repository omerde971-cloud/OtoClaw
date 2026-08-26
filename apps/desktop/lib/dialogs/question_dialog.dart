import 'package:flutter/material.dart';

import '../protocol/messages.dart';

/// AlertDialog for a QuestionAskPayload: one button per option, plus an
/// optional free-text field when allowFreeText is true. onAnswer receives
/// either {optionId} or {freeText}, mirroring QuestionRespondParams.
class QuestionDialog extends StatefulWidget {
  const QuestionDialog({
    super.key,
    required this.payload,
    required this.onAnswer,
  });

  final QuestionAskPayload payload;
  final void Function({String? optionId, String? freeText}) onAnswer;

  static Future<void> show(
    BuildContext context,
    QuestionAskPayload payload,
    void Function({String? optionId, String? freeText}) onAnswer,
  ) {
    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => QuestionDialog(payload: payload, onAnswer: onAnswer),
    );
  }

  @override
  State<QuestionDialog> createState() => _QuestionDialogState();
}

class _QuestionDialogState extends State<QuestionDialog> {
  final _freeTextController = TextEditingController();

  @override
  void dispose() {
    _freeTextController.dispose();
    super.dispose();
  }

  void _respondOption(String optionId) {
    Navigator.of(context).pop();
    widget.onAnswer(optionId: optionId);
  }

  void _respondFreeText() {
    final text = _freeTextController.text;
    if (text.isEmpty) return;
    Navigator.of(context).pop();
    widget.onAnswer(freeText: text);
  }

  @override
  Widget build(BuildContext context) {
    final payload = widget.payload;
    return AlertDialog(
      title: Text(payload.header),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(payload.question),
          const SizedBox(height: 8),
          for (final option in payload.options)
            TextButton(
              onPressed: () => _respondOption(option.id),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(option.label),
              ),
            ),
          if (payload.allowFreeText == true) ...[
            const SizedBox(height: 8),
            TextField(
              controller: _freeTextController,
              decoration: const InputDecoration(hintText: 'Type your own…'),
              onSubmitted: (_) => _respondFreeText(),
            ),
            TextButton(
              onPressed: _respondFreeText,
              child: const Text('Submit'),
            ),
          ],
        ],
      ),
    );
  }
}
