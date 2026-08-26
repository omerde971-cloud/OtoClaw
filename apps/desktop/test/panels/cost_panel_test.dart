import 'dart:async';

import 'package:desktop/daemon/ws_client.dart';
import 'package:desktop/panels/cost_panel.dart';
import 'package:desktop/protocol/messages.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('shows placeholder before any cost.update arrives', (tester) async {
    final controller = StreamController<CostUpdatePayload>.broadcast();
    addTearDown(controller.close);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CostPanel(
            client: WsClient('ws://127.0.0.1:0/ws'),
            costUpdates: controller.stream,
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Maliyet verisi bekleniyor'), findsOneWidget);
  });

  testWidgets('updates displayed values as cost.update notifications arrive', (tester) async {
    final controller = StreamController<CostUpdatePayload>.broadcast();
    addTearDown(controller.close);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CostPanel(
            client: WsClient('ws://127.0.0.1:0/ws'),
            sessionId: 'session-1',
            costUpdates: controller.stream,
          ),
        ),
      ),
    );
    await tester.pump();

    controller.add(
      const CostUpdatePayload(
        sessionId: 'session-1',
        tokensIn: 100,
        tokensOut: 50,
        usd: 0.02,
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.text('Tokens in: 100'), findsOneWidget);
    expect(find.text('Tokens out: 50'), findsOneWidget);
    expect(find.text('USD: 0.02'), findsOneWidget);

    controller.add(
      const CostUpdatePayload(
        sessionId: 'session-1',
        tokensIn: 200,
        tokensOut: 90,
        usd: 0.05,
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.text('Tokens in: 200'), findsOneWidget);
    expect(find.text('Tokens out: 90'), findsOneWidget);
    expect(find.text('USD: 0.05'), findsOneWidget);
  });

  testWidgets('ignores updates for a different session when sessionId is set', (tester) async {
    final controller = StreamController<CostUpdatePayload>.broadcast();
    addTearDown(controller.close);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: CostPanel(
            client: WsClient('ws://127.0.0.1:0/ws'),
            sessionId: 'session-1',
            costUpdates: controller.stream,
          ),
        ),
      ),
    );
    await tester.pump();

    controller.add(
      const CostUpdatePayload(
        sessionId: 'other-session',
        tokensIn: 5,
        tokensOut: 5,
        usd: 0.01,
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.text('Maliyet verisi bekleniyor'), findsOneWidget);
  });
}
