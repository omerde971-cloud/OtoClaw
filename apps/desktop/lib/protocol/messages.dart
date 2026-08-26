/// Dart data classes mirroring packages/shared/src/protocol.ts (wire types)
/// and the Config shape from packages/shared/src/config.ts. Data classes
/// only — no behavior. Keep field names identical to the TypeScript source.
library;

Map<String, dynamic> _asMap(Object? value) =>
    Map<String, dynamic>.from(value as Map);

List<T> _asList<T>(Object? value, T Function(Map<String, dynamic>) fromJson) {
  return (value as List)
      .map((e) => fromJson(_asMap(e)))
      .toList(growable: false);
}

// ---------------------------------------------------------------------------
// session.create / echo.send
// ---------------------------------------------------------------------------

class SessionCreateParams {
  const SessionCreateParams({required this.cwd, required this.mode});

  final String cwd;
  final String mode; // "manual" | "auto"

  factory SessionCreateParams.fromJson(Map<String, dynamic> json) {
    return SessionCreateParams(
      cwd: json['cwd'] as String,
      mode: json['mode'] as String,
    );
  }

  Map<String, dynamic> toJson() => {'cwd': cwd, 'mode': mode};
}

class SessionCreateResult {
  const SessionCreateResult({required this.sessionId});

  final String sessionId;

  factory SessionCreateResult.fromJson(Map<String, dynamic> json) {
    return SessionCreateResult(sessionId: json['sessionId'] as String);
  }

  Map<String, dynamic> toJson() => {'sessionId': sessionId};
}

class EchoSendParams {
  const EchoSendParams({required this.sessionId, required this.message});

  final String sessionId;
  final String message;

  factory EchoSendParams.fromJson(Map<String, dynamic> json) {
    return EchoSendParams(
      sessionId: json['sessionId'] as String,
      message: json['message'] as String,
    );
  }

  Map<String, dynamic> toJson() => {'sessionId': sessionId, 'message': message};
}

class EchoSendResult {
  const EchoSendResult();

  factory EchoSendResult.fromJson(Map<String, dynamic> json) =>
      const EchoSendResult();

  Map<String, dynamic> toJson() => {'ok': true};
}

class EchoEventPayload {
  const EchoEventPayload({
    required this.sessionId,
    required this.message,
    required this.ts,
  });

  final String sessionId;
  final String message;
  final String ts;

  factory EchoEventPayload.fromJson(Map<String, dynamic> json) {
    return EchoEventPayload(
      sessionId: json['sessionId'] as String,
      message: json['message'] as String,
      ts: json['ts'] as String,
    );
  }

  Map<String, dynamic> toJson() => {
    'sessionId': sessionId,
    'message': message,
    'ts': ts,
  };
}

// ---------------------------------------------------------------------------
// Phase 1d: message/run/permission/question/model/config wire types.
// ---------------------------------------------------------------------------

class MessageSendParams {
  const MessageSendParams({required this.sessionId, required this.text});

  final String sessionId;
  final String text;

  factory MessageSendParams.fromJson(Map<String, dynamic> json) {
    return MessageSendParams(
      sessionId: json['sessionId'] as String,
      text: json['text'] as String,
    );
  }

  Map<String, dynamic> toJson() => {'sessionId': sessionId, 'text': text};
}

class MessageSendResult {
  const MessageSendResult({required this.messageId});

  final String messageId;

  factory MessageSendResult.fromJson(Map<String, dynamic> json) {
    return MessageSendResult(messageId: json['messageId'] as String);
  }

  Map<String, dynamic> toJson() => {'messageId': messageId};
}

class RunCancelParams {
  const RunCancelParams({required this.sessionId});

  final String sessionId;

  factory RunCancelParams.fromJson(Map<String, dynamic> json) {
    return RunCancelParams(sessionId: json['sessionId'] as String);
  }

  Map<String, dynamic> toJson() => {'sessionId': sessionId};
}

class OkResult {
  const OkResult();

  factory OkResult.fromJson(Map<String, dynamic> json) => const OkResult();

  Map<String, dynamic> toJson() => {'ok': true};
}

class ModeSetParams {
  const ModeSetParams({required this.sessionId, required this.mode});

  final String sessionId;
  final String mode; // "manual" | "auto"

  factory ModeSetParams.fromJson(Map<String, dynamic> json) {
    return ModeSetParams(
      sessionId: json['sessionId'] as String,
      mode: json['mode'] as String,
    );
  }

  Map<String, dynamic> toJson() => {'sessionId': sessionId, 'mode': mode};
}

/// PermissionDecisionValue: "allow" | "ask" | "deny" | "always" | "never".
class PermissionRespondParams {
  const PermissionRespondParams({
    required this.requestId,
    required this.decision,
  });

  final String requestId;
  final String decision;

  factory PermissionRespondParams.fromJson(Map<String, dynamic> json) {
    return PermissionRespondParams(
      requestId: json['requestId'] as String,
      decision: json['decision'] as String,
    );
  }

  Map<String, dynamic> toJson() => {
    'requestId': requestId,
    'decision': decision,
  };
}

class QuestionRespondParams {
  const QuestionRespondParams({
    required this.questionId,
    this.optionId,
    this.freeText,
  });

  final String questionId;
  final String? optionId;
  final String? freeText;

  factory QuestionRespondParams.fromJson(Map<String, dynamic> json) {
    return QuestionRespondParams(
      questionId: json['questionId'] as String,
      optionId: json['optionId'] as String?,
      freeText: json['freeText'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'questionId': questionId,
    if (optionId != null) 'optionId': optionId,
    if (freeText != null) 'freeText': freeText,
  };
}

class ModelSetParams {
  const ModelSetParams({required this.sessionId, required this.model});

  final String sessionId;
  final String model;

  factory ModelSetParams.fromJson(Map<String, dynamic> json) {
    return ModelSetParams(
      sessionId: json['sessionId'] as String,
      model: json['model'] as String,
    );
  }

  Map<String, dynamic> toJson() => {'sessionId': sessionId, 'model': model};
}

class ModelListParams {
  const ModelListParams();

  factory ModelListParams.fromJson(Map<String, dynamic> json) =>
      const ModelListParams();

  Map<String, dynamic> toJson() => {};
}

class ModelInfo {
  const ModelInfo({
    required this.id,
    required this.provider,
    required this.contextWindow,
    required this.supportsTools,
    required this.supportsVision,
  });

  final String id;
  final String provider;
  final int contextWindow;
  final bool supportsTools;
  final bool supportsVision;

  factory ModelInfo.fromJson(Map<String, dynamic> json) {
    return ModelInfo(
      id: json['id'] as String,
      provider: json['provider'] as String,
      contextWindow: json['contextWindow'] as int,
      supportsTools: json['supportsTools'] as bool,
      supportsVision: json['supportsVision'] as bool,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'provider': provider,
    'contextWindow': contextWindow,
    'supportsTools': supportsTools,
    'supportsVision': supportsVision,
  };
}

class ConfigGetParams {
  const ConfigGetParams();

  factory ConfigGetParams.fromJson(Map<String, dynamic> json) =>
      const ConfigGetParams();

  Map<String, dynamic> toJson() => {};
}

class ConfigSetParams {
  const ConfigSetParams({required this.patch});

  final Map<String, dynamic> patch;

  factory ConfigSetParams.fromJson(Map<String, dynamic> json) {
    return ConfigSetParams(patch: _asMap(json['patch']));
  }

  Map<String, dynamic> toJson() => {'patch': patch};
}

class ProviderAddKeyParams {
  const ProviderAddKeyParams({required this.provider, required this.key});

  final String provider;
  final String key;

  factory ProviderAddKeyParams.fromJson(Map<String, dynamic> json) {
    return ProviderAddKeyParams(
      provider: json['provider'] as String,
      key: json['key'] as String,
    );
  }

  Map<String, dynamic> toJson() => {'provider': provider, 'key': key};
}

// ---------------------------------------------------------------------------
// Config (packages/shared/src/config.ts) — minimal Dart mirror of the zod
// schema fields needed by the client: mode/model/permissions/sandbox/
// judgeCouncil/mcpServers.
// ---------------------------------------------------------------------------

class McpServerConfig {
  const McpServerConfig({
    required this.name,
    required this.transport,
    this.command,
    this.args = const [],
    this.url,
  });

  final String name;
  final String transport; // "stdio" | "http"
  final String? command;
  final List<String> args;
  final String? url;

  factory McpServerConfig.fromJson(Map<String, dynamic> json) {
    return McpServerConfig(
      name: json['name'] as String,
      transport: json['transport'] as String,
      command: json['command'] as String?,
      args:
          (json['args'] as List?)?.map((e) => e as String).toList() ??
          const [],
      url: json['url'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'name': name,
    'transport': transport,
    if (command != null) 'command': command,
    'args': args,
    if (url != null) 'url': url,
  };
}

class SandboxConfig {
  const SandboxConfig({required this.auto});

  final bool auto;

  factory SandboxConfig.fromJson(Map<String, dynamic> json) {
    return SandboxConfig(auto: json['auto'] as bool);
  }

  Map<String, dynamic> toJson() => {'auto': auto};
}

class JudgeCouncilConfig {
  const JudgeCouncilConfig({required this.enabled, required this.lenses});

  final bool enabled;
  final List<String> lenses;

  factory JudgeCouncilConfig.fromJson(Map<String, dynamic> json) {
    return JudgeCouncilConfig(
      enabled: json['enabled'] as bool,
      lenses: (json['lenses'] as List).map((e) => e as String).toList(),
    );
  }

  Map<String, dynamic> toJson() => {'enabled': enabled, 'lenses': lenses};
}

class Config {
  const Config({
    required this.mode,
    this.model,
    required this.permissions,
    required this.sandbox,
    required this.mcpServers,
    required this.judgeCouncil,
  });

  final String mode; // "manual" | "auto"
  final String? model;
  final Map<String, String> permissions; // name -> PermissionDecisionValue
  final SandboxConfig sandbox;
  final List<McpServerConfig> mcpServers;
  final JudgeCouncilConfig judgeCouncil;

  factory Config.fromJson(Map<String, dynamic> json) {
    return Config(
      mode: json['mode'] as String,
      model: json['model'] as String?,
      permissions: Map<String, String>.from(
        (json['permissions'] as Map?) ?? const {},
      ),
      sandbox: SandboxConfig.fromJson(_asMap(json['sandbox'])),
      mcpServers: _asList(json['mcpServers'], McpServerConfig.fromJson),
      judgeCouncil: JudgeCouncilConfig.fromJson(_asMap(json['judgeCouncil'])),
    );
  }

  Map<String, dynamic> toJson() => {
    'mode': mode,
    if (model != null) 'model': model,
    'permissions': permissions,
    'sandbox': sandbox.toJson(),
    'mcpServers': mcpServers.map((e) => e.toJson()).toList(),
    'judgeCouncil': judgeCouncil.toJson(),
  };
}

typedef ConfigGetResult = Config;
typedef ConfigSetResult = OkResult;

// ---------------------------------------------------------------------------
// Notification payloads
// ---------------------------------------------------------------------------

class StreamDeltaPayload {
  const StreamDeltaPayload({required this.sessionId, required this.text});

  final String sessionId;
  final String text;

  factory StreamDeltaPayload.fromJson(Map<String, dynamic> json) {
    return StreamDeltaPayload(
      sessionId: json['sessionId'] as String,
      text: json['text'] as String,
    );
  }

  Map<String, dynamic> toJson() => {'sessionId': sessionId, 'text': text};
}

class PipelineStagePayload {
  const PipelineStagePayload({
    required this.sessionId,
    required this.stage,
    this.detail,
  });

  final String sessionId;
  final String stage;
  final String? detail;

  factory PipelineStagePayload.fromJson(Map<String, dynamic> json) {
    return PipelineStagePayload(
      sessionId: json['sessionId'] as String,
      stage: json['stage'] as String,
      detail: json['detail'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'sessionId': sessionId,
    'stage': stage,
    if (detail != null) 'detail': detail,
  };
}

class ToolStartPayload {
  const ToolStartPayload({
    required this.sessionId,
    required this.toolCallId,
    required this.name,
    required this.args,
  });

  final String sessionId;
  final String toolCallId;
  final String name;
  final Object? args;

  factory ToolStartPayload.fromJson(Map<String, dynamic> json) {
    return ToolStartPayload(
      sessionId: json['sessionId'] as String,
      toolCallId: json['toolCallId'] as String,
      name: json['name'] as String,
      args: json['args'],
    );
  }

  Map<String, dynamic> toJson() => {
    'sessionId': sessionId,
    'toolCallId': toolCallId,
    'name': name,
    'args': args,
  };
}

class ToolEndPayload {
  const ToolEndPayload({
    required this.sessionId,
    required this.toolCallId,
    required this.name,
    this.result,
  });

  final String sessionId;
  final String toolCallId;
  final String name;
  final Object? result;

  factory ToolEndPayload.fromJson(Map<String, dynamic> json) {
    return ToolEndPayload(
      sessionId: json['sessionId'] as String,
      toolCallId: json['toolCallId'] as String,
      name: json['name'] as String,
      result: json['result'],
    );
  }

  Map<String, dynamic> toJson() => {
    'sessionId': sessionId,
    'toolCallId': toolCallId,
    'name': name,
    if (result != null) 'result': result,
  };
}

class PermissionRisk {
  const PermissionRisk({required this.score, required this.reasons});

  final num score;
  final List<String> reasons;

  factory PermissionRisk.fromJson(Map<String, dynamic> json) {
    return PermissionRisk(
      score: json['score'] as num,
      reasons: (json['reasons'] as List).map((e) => e as String).toList(),
    );
  }

  Map<String, dynamic> toJson() => {'score': score, 'reasons': reasons};
}

class PermissionRequestPayload {
  const PermissionRequestPayload({
    required this.sessionId,
    required this.requestId,
    required this.tool,
    required this.args,
    required this.risk,
  });

  final String sessionId;
  final String requestId;
  final String tool;
  final Object? args;
  final PermissionRisk risk;

  factory PermissionRequestPayload.fromJson(Map<String, dynamic> json) {
    return PermissionRequestPayload(
      sessionId: json['sessionId'] as String,
      requestId: json['requestId'] as String,
      tool: json['tool'] as String,
      args: json['args'],
      risk: PermissionRisk.fromJson(_asMap(json['risk'])),
    );
  }

  Map<String, dynamic> toJson() => {
    'sessionId': sessionId,
    'requestId': requestId,
    'tool': tool,
    'args': args,
    'risk': risk.toJson(),
  };
}

class QuestionOptionPayload {
  const QuestionOptionPayload({
    required this.id,
    required this.label,
    this.description,
  });

  final String id;
  final String label;
  final String? description;

  factory QuestionOptionPayload.fromJson(Map<String, dynamic> json) {
    return QuestionOptionPayload(
      id: json['id'] as String,
      label: json['label'] as String,
      description: json['description'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'label': label,
    if (description != null) 'description': description,
  };
}

class QuestionAskPayload {
  const QuestionAskPayload({
    required this.sessionId,
    required this.questionId,
    required this.header,
    required this.question,
    required this.options,
    this.allowFreeText,
    this.multiSelect,
  });

  final String sessionId;
  final String questionId;
  final String header;
  final String question;
  final List<QuestionOptionPayload> options;
  final bool? allowFreeText;
  final bool? multiSelect;

  factory QuestionAskPayload.fromJson(Map<String, dynamic> json) {
    return QuestionAskPayload(
      sessionId: json['sessionId'] as String,
      questionId: json['questionId'] as String,
      header: json['header'] as String,
      question: json['question'] as String,
      options: _asList(json['options'], QuestionOptionPayload.fromJson),
      allowFreeText: json['allowFreeText'] as bool?,
      multiSelect: json['multiSelect'] as bool?,
    );
  }

  Map<String, dynamic> toJson() => {
    'sessionId': sessionId,
    'questionId': questionId,
    'header': header,
    'question': question,
    'options': options.map((e) => e.toJson()).toList(),
    if (allowFreeText != null) 'allowFreeText': allowFreeText,
    if (multiSelect != null) 'multiSelect': multiSelect,
  };
}

class MascotStatePayload {
  const MascotStatePayload({
    required this.sessionId,
    required this.state,
    required this.since,
  });

  final String sessionId;
  final String state;
  final String since;

  factory MascotStatePayload.fromJson(Map<String, dynamic> json) {
    return MascotStatePayload(
      sessionId: json['sessionId'] as String,
      state: json['state'] as String,
      since: json['since'] as String,
    );
  }

  Map<String, dynamic> toJson() => {
    'sessionId': sessionId,
    'state': state,
    'since': since,
  };
}

class CostUpdatePayload {
  const CostUpdatePayload({
    required this.sessionId,
    required this.tokensIn,
    required this.tokensOut,
    required this.usd,
  });

  final String sessionId;
  final int tokensIn;
  final int tokensOut;
  final num usd;

  factory CostUpdatePayload.fromJson(Map<String, dynamic> json) {
    return CostUpdatePayload(
      sessionId: json['sessionId'] as String,
      tokensIn: json['tokensIn'] as int,
      tokensOut: json['tokensOut'] as int,
      usd: json['usd'] as num,
    );
  }

  Map<String, dynamic> toJson() => {
    'sessionId': sessionId,
    'tokensIn': tokensIn,
    'tokensOut': tokensOut,
    'usd': usd,
  };
}

class ErrorEventPayload {
  const ErrorEventPayload({
    this.sessionId,
    required this.code,
    required this.message,
    required this.recoverable,
  });

  final String? sessionId;
  final String code;
  final String message;
  final bool recoverable;

  factory ErrorEventPayload.fromJson(Map<String, dynamic> json) {
    return ErrorEventPayload(
      sessionId: json['sessionId'] as String?,
      code: json['code'] as String,
      message: json['message'] as String,
      recoverable: json['recoverable'] as bool,
    );
  }

  Map<String, dynamic> toJson() => {
    if (sessionId != null) 'sessionId': sessionId,
    'code': code,
    'message': message,
    'recoverable': recoverable,
  };
}

class JudgeVerdictPayload {
  const JudgeVerdictPayload({
    required this.sessionId,
    required this.target,
    required this.score,
    required this.label,
    required this.notes,
  });

  final String sessionId;
  final String target;
  final num score;
  final String label; // "good" | "bad"
  final List<String> notes;

  factory JudgeVerdictPayload.fromJson(Map<String, dynamic> json) {
    return JudgeVerdictPayload(
      sessionId: json['sessionId'] as String,
      target: json['target'] as String,
      score: json['score'] as num,
      label: json['label'] as String,
      notes: (json['notes'] as List).map((e) => e as String).toList(),
    );
  }

  Map<String, dynamic> toJson() => {
    'sessionId': sessionId,
    'target': target,
    'score': score,
    'label': label,
    'notes': notes,
  };
}

// ---------------------------------------------------------------------------
// skill.*
// ---------------------------------------------------------------------------

class SkillListParams {
  const SkillListParams();

  factory SkillListParams.fromJson(Map<String, dynamic> json) =>
      const SkillListParams();

  Map<String, dynamic> toJson() => {};
}

class SkillInfo {
  const SkillInfo({
    required this.name,
    required this.description,
    required this.triggers,
    required this.version,
    required this.source,
  });

  final String name;
  final String description;
  final List<String> triggers;
  final String version;
  final String source;

  factory SkillInfo.fromJson(Map<String, dynamic> json) {
    return SkillInfo(
      name: json['name'] as String,
      description: json['description'] as String,
      triggers: (json['triggers'] as List).map((e) => e as String).toList(),
      version: json['version'] as String,
      source: json['source'] as String,
    );
  }

  Map<String, dynamic> toJson() => {
    'name': name,
    'description': description,
    'triggers': triggers,
    'version': version,
    'source': source,
  };
}

typedef SkillListResult = List<SkillInfo>;

class SkillInstallParams {
  const SkillInstallParams({required this.name});

  final String name;

  factory SkillInstallParams.fromJson(Map<String, dynamic> json) {
    return SkillInstallParams(name: json['name'] as String);
  }

  Map<String, dynamic> toJson() => {'name': name};
}

typedef SkillInstallResult = OkResult;

// ---------------------------------------------------------------------------
// mcp.*
// ---------------------------------------------------------------------------

class McpConnectParams {
  const McpConnectParams({required this.name});

  final String name;

  factory McpConnectParams.fromJson(Map<String, dynamic> json) {
    return McpConnectParams(name: json['name'] as String);
  }

  Map<String, dynamic> toJson() => {'name': name};
}

class McpConnectResult {
  const McpConnectResult({required this.ok, required this.status, this.error});

  final bool ok;
  final String status;
  final String? error;

  factory McpConnectResult.fromJson(Map<String, dynamic> json) {
    return McpConnectResult(
      ok: json['ok'] as bool,
      status: json['status'] as String,
      error: json['error'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'ok': ok,
    'status': status,
    if (error != null) 'error': error,
  };
}

class McpDisconnectParams {
  const McpDisconnectParams({required this.name});

  final String name;

  factory McpDisconnectParams.fromJson(Map<String, dynamic> json) {
    return McpDisconnectParams(name: json['name'] as String);
  }

  Map<String, dynamic> toJson() => {'name': name};
}

typedef McpDisconnectResult = OkResult;

class McpListParams {
  const McpListParams();

  factory McpListParams.fromJson(Map<String, dynamic> json) =>
      const McpListParams();

  Map<String, dynamic> toJson() => {};
}

class McpServerInfo {
  const McpServerInfo({
    required this.name,
    required this.transport,
    required this.status,
  });

  final String name;
  final String transport; // "stdio" | "http"
  final String status;

  factory McpServerInfo.fromJson(Map<String, dynamic> json) {
    return McpServerInfo(
      name: json['name'] as String,
      transport: json['transport'] as String,
      status: json['status'] as String,
    );
  }

  Map<String, dynamic> toJson() => {
    'name': name,
    'transport': transport,
    'status': status,
  };
}

typedef McpListResult = List<McpServerInfo>;

class McpStatusPayload {
  const McpStatusPayload({
    required this.name,
    required this.status,
    this.error,
  });

  final String name;
  final String status;
  final String? error;

  factory McpStatusPayload.fromJson(Map<String, dynamic> json) {
    return McpStatusPayload(
      name: json['name'] as String,
      status: json['status'] as String,
      error: json['error'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'name': name,
    'status': status,
    if (error != null) 'error': error,
  };
}

// ---------------------------------------------------------------------------
// Phase 2a: sub-agent orchestration events.
// ---------------------------------------------------------------------------

class SubAgentBudget {
  const SubAgentBudget({required this.tokens, required this.steps});

  final int tokens;
  final int steps;

  factory SubAgentBudget.fromJson(Map<String, dynamic> json) {
    return SubAgentBudget(
      tokens: json['tokens'] as int,
      steps: json['steps'] as int,
    );
  }

  Map<String, dynamic> toJson() => {'tokens': tokens, 'steps': steps};
}

class SubAgentBriefPayload {
  const SubAgentBriefPayload({
    required this.role,
    required this.goal,
    required this.inputs,
    required this.constraints,
    required this.acceptance,
    required this.budget,
  });

  /// "researcher" | "coder" | "tester" | "reviewer"
  final String role;
  final String goal;
  final Map<String, dynamic> inputs;
  final List<String> constraints;
  final List<String> acceptance;
  final SubAgentBudget budget;

  factory SubAgentBriefPayload.fromJson(Map<String, dynamic> json) {
    return SubAgentBriefPayload(
      role: json['role'] as String,
      goal: json['goal'] as String,
      inputs: _asMap(json['inputs']),
      constraints: (json['constraints'] as List)
          .map((e) => e as String)
          .toList(),
      acceptance: (json['acceptance'] as List)
          .map((e) => e as String)
          .toList(),
      budget: SubAgentBudget.fromJson(_asMap(json['budget'])),
    );
  }

  Map<String, dynamic> toJson() => {
    'role': role,
    'goal': goal,
    'inputs': inputs,
    'constraints': constraints,
    'acceptance': acceptance,
    'budget': budget.toJson(),
  };
}

class SubAgentWorktree {
  const SubAgentWorktree({
    required this.path,
    required this.branch,
    required this.diff,
  });

  final String path;
  final String branch;
  final String diff;

  factory SubAgentWorktree.fromJson(Map<String, dynamic> json) {
    return SubAgentWorktree(
      path: json['path'] as String,
      branch: json['branch'] as String,
      diff: json['diff'] as String,
    );
  }

  Map<String, dynamic> toJson() => {
    'path': path,
    'branch': branch,
    'diff': diff,
  };
}

class SubAgentResultPayload {
  const SubAgentResultPayload({
    required this.agentId,
    required this.role,
    required this.ok,
    required this.text,
    required this.notes,
    required this.tokensUsed,
    required this.stepsUsed,
    this.worktree,
  });

  final String agentId;
  final String role;
  final bool ok;
  final String text;
  final List<String> notes;
  final int tokensUsed;
  final int stepsUsed;
  final SubAgentWorktree? worktree;

  factory SubAgentResultPayload.fromJson(Map<String, dynamic> json) {
    return SubAgentResultPayload(
      agentId: json['agentId'] as String,
      role: json['role'] as String,
      ok: json['ok'] as bool,
      text: json['text'] as String,
      notes: (json['notes'] as List).map((e) => e as String).toList(),
      tokensUsed: json['tokensUsed'] as int,
      stepsUsed: json['stepsUsed'] as int,
      worktree: json['worktree'] != null
          ? SubAgentWorktree.fromJson(_asMap(json['worktree']))
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'agentId': agentId,
    'role': role,
    'ok': ok,
    'text': text,
    'notes': notes,
    'tokensUsed': tokensUsed,
    'stepsUsed': stepsUsed,
    'worktree': worktree?.toJson(),
  };
}

class SubAgentSpawnPayload {
  const SubAgentSpawnPayload({
    required this.sessionId,
    required this.agentId,
    required this.role,
    required this.brief,
    required this.status,
  });

  final String sessionId;
  final String agentId;
  final String role;
  final SubAgentBriefPayload brief;
  final String status;

  factory SubAgentSpawnPayload.fromJson(Map<String, dynamic> json) {
    return SubAgentSpawnPayload(
      sessionId: json['sessionId'] as String,
      agentId: json['agentId'] as String,
      role: json['role'] as String,
      brief: SubAgentBriefPayload.fromJson(_asMap(json['brief'])),
      status: json['status'] as String,
    );
  }

  Map<String, dynamic> toJson() => {
    'sessionId': sessionId,
    'agentId': agentId,
    'role': role,
    'brief': brief.toJson(),
    'status': status,
  };
}

class SubAgentUpdatePayload {
  const SubAgentUpdatePayload({
    required this.sessionId,
    required this.agentId,
    required this.role,
    required this.brief,
    required this.status,
  });

  final String sessionId;
  final String agentId;
  final String role;
  final SubAgentBriefPayload brief;
  final String status;

  factory SubAgentUpdatePayload.fromJson(Map<String, dynamic> json) {
    return SubAgentUpdatePayload(
      sessionId: json['sessionId'] as String,
      agentId: json['agentId'] as String,
      role: json['role'] as String,
      brief: SubAgentBriefPayload.fromJson(_asMap(json['brief'])),
      status: json['status'] as String,
    );
  }

  Map<String, dynamic> toJson() => {
    'sessionId': sessionId,
    'agentId': agentId,
    'role': role,
    'brief': brief.toJson(),
    'status': status,
  };
}

class SubAgentDonePayload {
  const SubAgentDonePayload({
    required this.sessionId,
    required this.agentId,
    required this.role,
    required this.brief,
    required this.status,
    this.result,
  });

  final String sessionId;
  final String agentId;
  final String role;
  final SubAgentBriefPayload brief;
  final String status;
  final SubAgentResultPayload? result;

  factory SubAgentDonePayload.fromJson(Map<String, dynamic> json) {
    return SubAgentDonePayload(
      sessionId: json['sessionId'] as String,
      agentId: json['agentId'] as String,
      role: json['role'] as String,
      brief: SubAgentBriefPayload.fromJson(_asMap(json['brief'])),
      status: json['status'] as String,
      result: json['result'] != null
          ? SubAgentResultPayload.fromJson(_asMap(json['result']))
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'sessionId': sessionId,
    'agentId': agentId,
    'role': role,
    'brief': brief.toJson(),
    'status': status,
    'result': result?.toJson(),
  };
}
