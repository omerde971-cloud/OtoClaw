import 'dart:convert';

import 'package:desktop/protocol/messages.dart';
import 'package:flutter_test/flutter_test.dart';

/// Round-trips [value] through toJson()/fromJson() and asserts the
/// re-encoded JSON is identical to the original encoding.
void expectRoundTrip<T>(
  Map<String, dynamic> Function(T) toJson,
  T Function(Map<String, dynamic>) fromJson,
  T value,
) {
  final encoded = jsonEncode(toJson(value));
  final decoded = fromJson(jsonDecode(encoded) as Map<String, dynamic>);
  final reEncoded = jsonEncode(toJson(decoded));
  expect(reEncoded, encoded);
}

void main() {
  test('SessionCreateParams round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      SessionCreateParams.fromJson,
      const SessionCreateParams(cwd: '/tmp/proj', mode: 'auto'),
    );
  });

  test('SessionCreateResult round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      SessionCreateResult.fromJson,
      const SessionCreateResult(sessionId: 's1'),
    );
  });

  test('EchoSendParams round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      EchoSendParams.fromJson,
      const EchoSendParams(sessionId: 's1', message: 'hi'),
    );
  });

  test('EchoSendResult round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      EchoSendResult.fromJson,
      const EchoSendResult(),
    );
  });

  test('EchoEventPayload round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      EchoEventPayload.fromJson,
      const EchoEventPayload(sessionId: 's1', message: 'hi', ts: '2026-08-26T00:00:00Z'),
    );
  });

  test('MessageSendParams round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      MessageSendParams.fromJson,
      const MessageSendParams(sessionId: 's1', text: 'hello'),
    );
  });

  test('MessageSendResult round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      MessageSendResult.fromJson,
      const MessageSendResult(messageId: 'm1'),
    );
  });

  test('RunCancelParams round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      RunCancelParams.fromJson,
      const RunCancelParams(sessionId: 's1'),
    );
  });

  test('OkResult round-trip', () {
    expectRoundTrip((v) => v.toJson(), OkResult.fromJson, const OkResult());
  });

  test('ModeSetParams round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      ModeSetParams.fromJson,
      const ModeSetParams(sessionId: 's1', mode: 'manual'),
    );
  });

  test('PermissionRespondParams round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      PermissionRespondParams.fromJson,
      const PermissionRespondParams(requestId: 'r1', decision: 'allow'),
    );
  });

  test('QuestionRespondParams round-trip (with optionals)', () {
    expectRoundTrip(
      (v) => v.toJson(),
      QuestionRespondParams.fromJson,
      const QuestionRespondParams(
        questionId: 'q1',
        optionId: 'opt1',
        freeText: 'note',
      ),
    );
  });

  test('QuestionRespondParams round-trip (minimal)', () {
    expectRoundTrip(
      (v) => v.toJson(),
      QuestionRespondParams.fromJson,
      const QuestionRespondParams(questionId: 'q1'),
    );
  });

  test('ModelSetParams round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      ModelSetParams.fromJson,
      const ModelSetParams(sessionId: 's1', model: 'claude-sonnet'),
    );
  });

  test('ModelListParams round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      ModelListParams.fromJson,
      const ModelListParams(),
    );
  });

  test('ModelInfo round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      ModelInfo.fromJson,
      const ModelInfo(
        id: 'claude-sonnet-5',
        provider: 'anthropic',
        contextWindow: 200000,
        supportsTools: true,
        supportsVision: true,
      ),
    );
  });

  test('ConfigGetParams round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      ConfigGetParams.fromJson,
      const ConfigGetParams(),
    );
  });

  test('ConfigSetParams round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      ConfigSetParams.fromJson,
      const ConfigSetParams(patch: {'mode': 'auto'}),
    );
  });

  test('ProviderAddKeyParams round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      ProviderAddKeyParams.fromJson,
      const ProviderAddKeyParams(provider: 'anthropic', key: 'sk-test'),
    );
  });

  test('Config round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      Config.fromJson,
      Config(
        mode: 'auto',
        model: 'claude-sonnet-5',
        permissions: const {'shell': 'ask'},
        sandbox: const SandboxConfig(auto: true),
        mcpServers: const [
          McpServerConfig(
            name: 'fs',
            transport: 'stdio',
            command: 'bunx',
            args: ['mcp-fs'],
          ),
        ],
        judgeCouncil: const JudgeCouncilConfig(
          enabled: false,
          lenses: ['correctness', 'functional', 'aesthetics'],
        ),
      ),
    );
  });

  test('McpServerConfig round-trip (minimal)', () {
    expectRoundTrip(
      (v) => v.toJson(),
      McpServerConfig.fromJson,
      const McpServerConfig(name: 'x', transport: 'http', url: 'http://x'),
    );
  });

  test('StreamDeltaPayload round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      StreamDeltaPayload.fromJson,
      const StreamDeltaPayload(sessionId: 's1', text: 'chunk'),
    );
  });

  test('PipelineStagePayload round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      PipelineStagePayload.fromJson,
      const PipelineStagePayload(sessionId: 's1', stage: 'plan', detail: 'x'),
    );
  });

  test('ToolStartPayload round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      ToolStartPayload.fromJson,
      const ToolStartPayload(
        sessionId: 's1',
        toolCallId: 't1',
        name: 'bash',
        args: {'cmd': 'ls'},
      ),
    );
  });

  test('ToolEndPayload round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      ToolEndPayload.fromJson,
      const ToolEndPayload(
        sessionId: 's1',
        toolCallId: 't1',
        name: 'bash',
        result: 'ok',
      ),
    );
  });

  test('PermissionRequestPayload round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      PermissionRequestPayload.fromJson,
      const PermissionRequestPayload(
        sessionId: 's1',
        requestId: 'r1',
        tool: 'shell',
        args: {'cmd': 'rm -rf /'},
        risk: PermissionRisk(score: 0.9, reasons: ['destructive']),
      ),
    );
  });

  test('QuestionOptionPayload round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      QuestionOptionPayload.fromJson,
      const QuestionOptionPayload(id: 'o1', label: 'Yes', description: 'ok'),
    );
  });

  test('QuestionAskPayload round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      QuestionAskPayload.fromJson,
      const QuestionAskPayload(
        sessionId: 's1',
        questionId: 'q1',
        header: 'Confirm',
        question: 'Proceed?',
        options: [QuestionOptionPayload(id: 'o1', label: 'Yes')],
        allowFreeText: true,
        multiSelect: false,
      ),
    );
  });

  test('MascotStatePayload round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      MascotStatePayload.fromJson,
      const MascotStatePayload(sessionId: 's1', state: 'thinking', since: 'now'),
    );
  });

  test('CostUpdatePayload round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      CostUpdatePayload.fromJson,
      const CostUpdatePayload(sessionId: 's1', tokensIn: 10, tokensOut: 20, usd: 0.01),
    );
  });

  test('ErrorEventPayload round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      ErrorEventPayload.fromJson,
      const ErrorEventPayload(
        sessionId: 's1',
        code: 'E_TOOL',
        message: 'failed',
        recoverable: true,
      ),
    );
  });

  test('JudgeVerdictPayload round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      JudgeVerdictPayload.fromJson,
      const JudgeVerdictPayload(
        sessionId: 's1',
        target: 'diff',
        score: 0.8,
        label: 'good',
        notes: ['clean'],
      ),
    );
  });

  test('SkillListParams round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      SkillListParams.fromJson,
      const SkillListParams(),
    );
  });

  test('SkillInfo round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      SkillInfo.fromJson,
      const SkillInfo(
        name: 'demo',
        description: 'demo skill',
        triggers: ['demo'],
        version: '1.0.0',
        source: 'local',
      ),
    );
  });

  test('SkillInstallParams round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      SkillInstallParams.fromJson,
      const SkillInstallParams(name: 'demo'),
    );
  });

  test('McpConnectParams round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      McpConnectParams.fromJson,
      const McpConnectParams(name: 'fs'),
    );
  });

  test('McpConnectResult round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      McpConnectResult.fromJson,
      const McpConnectResult(ok: true, status: 'connected'),
    );
  });

  test('McpConnectResult round-trip (with error)', () {
    expectRoundTrip(
      (v) => v.toJson(),
      McpConnectResult.fromJson,
      const McpConnectResult(ok: false, status: 'failed', error: 'timeout'),
    );
  });

  test('McpDisconnectParams round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      McpDisconnectParams.fromJson,
      const McpDisconnectParams(name: 'fs'),
    );
  });

  test('McpListParams round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      McpListParams.fromJson,
      const McpListParams(),
    );
  });

  test('McpServerInfo round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      McpServerInfo.fromJson,
      const McpServerInfo(name: 'fs', transport: 'stdio', status: 'connected'),
    );
  });

  test('McpStatusPayload round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      McpStatusPayload.fromJson,
      const McpStatusPayload(name: 'fs', status: 'error', error: 'timeout'),
    );
  });

  test('SubAgentBriefPayload round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      SubAgentBriefPayload.fromJson,
      const SubAgentBriefPayload(
        role: 'coder',
        goal: 'implement feature',
        inputs: {'file': 'a.ts'},
        constraints: ['no new deps'],
        acceptance: ['tests pass'],
        budget: SubAgentBudget(tokens: 1000, steps: 10),
      ),
    );
  });

  test('SubAgentResultPayload round-trip (with worktree)', () {
    expectRoundTrip(
      (v) => v.toJson(),
      SubAgentResultPayload.fromJson,
      const SubAgentResultPayload(
        agentId: 'a1',
        role: 'coder',
        ok: true,
        text: 'done',
        notes: ['clean'],
        tokensUsed: 500,
        stepsUsed: 5,
        worktree: SubAgentWorktree(path: '/wt', branch: 'feat', diff: 'diff'),
      ),
    );
  });

  test('SubAgentResultPayload round-trip (no worktree)', () {
    expectRoundTrip(
      (v) => v.toJson(),
      SubAgentResultPayload.fromJson,
      const SubAgentResultPayload(
        agentId: 'a1',
        role: 'researcher',
        ok: false,
        text: 'failed',
        notes: [],
        tokensUsed: 100,
        stepsUsed: 1,
      ),
    );
  });

  const brief = SubAgentBriefPayload(
    role: 'tester',
    goal: 'write tests',
    inputs: {},
    constraints: [],
    acceptance: ['green'],
    budget: SubAgentBudget(tokens: 100, steps: 2),
  );

  test('SubAgentSpawnPayload round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      SubAgentSpawnPayload.fromJson,
      const SubAgentSpawnPayload(
        sessionId: 's1',
        agentId: 'a1',
        role: 'tester',
        brief: brief,
        status: 'spawned',
      ),
    );
  });

  test('SubAgentUpdatePayload round-trip', () {
    expectRoundTrip(
      (v) => v.toJson(),
      SubAgentUpdatePayload.fromJson,
      const SubAgentUpdatePayload(
        sessionId: 's1',
        agentId: 'a1',
        role: 'tester',
        brief: brief,
        status: 'running',
      ),
    );
  });

  test('SubAgentDonePayload round-trip (with result)', () {
    expectRoundTrip(
      (v) => v.toJson(),
      SubAgentDonePayload.fromJson,
      const SubAgentDonePayload(
        sessionId: 's1',
        agentId: 'a1',
        role: 'tester',
        brief: brief,
        status: 'done',
        result: SubAgentResultPayload(
          agentId: 'a1',
          role: 'tester',
          ok: true,
          text: 'done',
          notes: [],
          tokensUsed: 10,
          stepsUsed: 1,
        ),
      ),
    );
  });

  test('SubAgentDonePayload round-trip (no result)', () {
    expectRoundTrip(
      (v) => v.toJson(),
      SubAgentDonePayload.fromJson,
      const SubAgentDonePayload(
        sessionId: 's1',
        agentId: 'a1',
        role: 'tester',
        brief: brief,
        status: 'cancelled',
      ),
    );
  });
}
