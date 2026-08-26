import 'package:flutter/material.dart';

import '../daemon/ws_client.dart';
import '../protocol/messages.dart';

/// Lists available models via `model.list` and switches the session's model
/// via `model.set` on selection.
class ModelPanel extends StatefulWidget {
  const ModelPanel({super.key, required this.client, required this.sessionId});

  final WsClient client;
  final String sessionId;

  @override
  State<ModelPanel> createState() => _ModelPanelState();
}

class _ModelPanelState extends State<ModelPanel> {
  List<ModelInfo>? _models;
  String? _selectedModelId;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadModels();
  }

  Future<void> _loadModels() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await widget.client.request<Object?>(
        'model.list',
        const ModelListParams().toJson(),
      );
      final models = (result as List)
          .map((e) => ModelInfo.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(growable: false);
      if (!mounted) return;
      setState(() {
        _models = models;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _onSelected(String? modelId) async {
    if (modelId == null) return;
    setState(() {
      _selectedModelId = modelId;
      _error = null;
    });
    try {
      await widget.client.request<Object?>(
        'model.set',
        ModelSetParams(sessionId: widget.sessionId, model: modelId).toJson(),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    final error = _error;
    final models = _models;

    if (models == null) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Model listesi alınamadı: ${error ?? 'bilinmeyen hata'}'),
          TextButton(onPressed: _loadModels, child: const Text('Tekrar dene')),
        ],
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DropdownButton<String>(
          value: _selectedModelId,
          hint: const Text('Model seç'),
          items: [
            for (final model in models)
              DropdownMenuItem(value: model.id, child: Text('${model.id} (${model.provider})')),
          ],
          onChanged: _onSelected,
        ),
        if (error != null) Text(error, style: const TextStyle(color: Colors.red)),
      ],
    );
  }
}
