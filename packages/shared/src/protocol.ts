import type { Config, PermissionDecisionValue } from "./config";

export interface JsonRpcRequest<
	TMethod extends string = string,
	TParams = unknown,
> {
	jsonrpc: "2.0";
	id: number | string;
	method: TMethod;
	params: TParams;
}

export interface JsonRpcResponse<TResult = unknown> {
	jsonrpc: "2.0";
	id: number | string;
	result?: TResult;
	error?: JsonRpcError;
}

export interface JsonRpcError {
	code: number;
	message: string;
	data?: unknown;
}

export interface JsonRpcNotification<
	TMethod extends string = string,
	TParams = unknown,
> {
	jsonrpc: "2.0";
	method: TMethod;
	params: TParams;
}

export interface SessionCreateParams {
	cwd: string;
	mode: "manual" | "auto";
}

export interface SessionCreateResult {
	sessionId: string;
}

export interface EchoSendParams {
	sessionId: string;
	message: string;
}

export interface EchoSendResult {
	ok: true;
}

export interface EchoEventPayload {
	sessionId: string;
	message: string;
	ts: string;
}

export type SessionCreateRequest = JsonRpcRequest<
	"session.create",
	SessionCreateParams
>;
export type EchoSendRequest = JsonRpcRequest<"echo.send", EchoSendParams>;

export type EchoNotification = JsonRpcNotification<"echo", EchoEventPayload>;

// ---------------------------------------------------------------------------
// Phase 1d: message/run/permission/question/model/config wire types.
// See ARCHITECTURE.md §3.2/§3.3. Deliberately excludes skill.*, subagent.*,
// mcp.* — those are Phase 2+. judge.verdict was added in Phase 2b.
// ---------------------------------------------------------------------------

export interface MessageSendParams {
	sessionId: string;
	text: string;
}

export interface MessageSendResult {
	messageId: string;
}

export interface RunCancelParams {
	sessionId: string;
}

export interface OkResult {
	ok: true;
}

export interface ModeSetParams {
	sessionId: string;
	mode: "manual" | "auto";
}

export interface PermissionRespondParams {
	requestId: string;
	decision: PermissionDecisionValue;
}

export interface QuestionRespondParams {
	questionId: string;
	optionId?: string;
	freeText?: string;
}

export interface ModelSetParams {
	sessionId: string;
	model: string;
}

export interface ModelListParams {
	[key: string]: never;
}

export interface ModelInfo {
	id: string;
	provider: string;
	contextWindow: number;
	supportsTools: boolean;
	supportsVision: boolean;
}

export interface ConfigGetParams {
	[key: string]: never;
}

export interface ConfigSetParams {
	patch: Record<string, unknown>;
}

export interface ProviderAddKeyParams {
	provider: string;
	key: string;
}

export type ConfigGetResult = Config;
export type ConfigSetResult = OkResult;

export type MessageSendRequest = JsonRpcRequest<"message.send", MessageSendParams>;
export type RunCancelRequest = JsonRpcRequest<"run.cancel", RunCancelParams>;
export type ModeSetRequest = JsonRpcRequest<"mode.set", ModeSetParams>;
export type PermissionRespondRequest = JsonRpcRequest<"permission.respond", PermissionRespondParams>;
export type QuestionRespondRequest = JsonRpcRequest<"question.respond", QuestionRespondParams>;
export type ModelSetRequest = JsonRpcRequest<"model.set", ModelSetParams>;
export type ModelListRequest = JsonRpcRequest<"model.list", ModelListParams>;
export type ConfigGetRequest = JsonRpcRequest<"config.get", ConfigGetParams>;
export type ConfigSetRequest = JsonRpcRequest<"config.set", ConfigSetParams>;
export type ProviderAddKeyRequest = JsonRpcRequest<"provider.addKey", ProviderAddKeyParams>;

export interface StreamDeltaPayload {
	sessionId: string;
	text: string;
}

export interface PipelineStagePayload {
	sessionId: string;
	stage: string;
	detail?: string;
}

export interface ToolStartPayload {
	sessionId: string;
	toolCallId: string;
	name: string;
	args: unknown;
}

export interface ToolEndPayload {
	sessionId: string;
	toolCallId: string;
	name: string;
	result?: unknown;
}

export interface PermissionRequestPayload {
	sessionId: string;
	requestId: string;
	tool: string;
	args: unknown;
	risk: { score: number; reasons: string[] };
}

export interface QuestionOptionPayload {
	id: string;
	label: string;
	description?: string;
}

export interface QuestionAskPayload {
	sessionId: string;
	questionId: string;
	header: string;
	question: string;
	options: QuestionOptionPayload[];
	allowFreeText?: boolean;
	multiSelect?: boolean;
}

export interface MascotStatePayload {
	sessionId: string;
	state: string;
	since: string;
}

export interface CostUpdatePayload {
	sessionId: string;
	tokensIn: number;
	tokensOut: number;
	usd: number;
}

export interface ErrorEventPayload {
	sessionId?: string;
	code: string;
	message: string;
	recoverable: boolean;
}

export interface JudgeVerdictPayload {
	sessionId: string;
	target: string;
	score: number;
	label: "good" | "bad";
	notes: string[];
}

export interface SkillListParams {
	[key: string]: never;
}

export interface SkillInfo {
	name: string;
	description: string;
	triggers: string[];
	version: string;
	source: string;
}

export type SkillListResult = SkillInfo[];

export interface SkillInstallParams {
	name: string;
}

export type SkillInstallResult = OkResult;

export type SkillListRequest = JsonRpcRequest<"skill.list", SkillListParams>;
export type SkillInstallRequest = JsonRpcRequest<"skill.install", SkillInstallParams>;

// ---------------------------------------------------------------------------
// Phase 2d: MCP host wire types. See ARCHITECTURE.md §12.
// ---------------------------------------------------------------------------

export interface McpConnectParams {
	name: string;
}

export interface McpConnectResult {
	ok: boolean;
	status: string;
	error?: string;
}

export interface McpDisconnectParams {
	name: string;
}

export type McpDisconnectResult = OkResult;

export interface McpListParams {
	[key: string]: never;
}

export interface McpServerInfo {
	name: string;
	transport: "stdio" | "http";
	status: string;
}

export type McpListResult = McpServerInfo[];

export type McpConnectRequest = JsonRpcRequest<"mcp.connect", McpConnectParams>;
export type McpDisconnectRequest = JsonRpcRequest<"mcp.disconnect", McpDisconnectParams>;
export type McpListRequest = JsonRpcRequest<"mcp.list", McpListParams>;

export interface McpStatusPayload {
	name: string;
	status: string;
	error?: string;
}

export type McpStatusNotification = JsonRpcNotification<"mcp.status", McpStatusPayload>;

export type StreamDeltaNotification = JsonRpcNotification<"stream.delta", StreamDeltaPayload>;
export type PipelineStageNotification = JsonRpcNotification<"pipeline.stage", PipelineStagePayload>;
export type ToolStartNotification = JsonRpcNotification<"tool.start", ToolStartPayload>;
export type ToolEndNotification = JsonRpcNotification<"tool.end", ToolEndPayload>;
export type PermissionRequestNotification = JsonRpcNotification<"permission.request", PermissionRequestPayload>;
export type QuestionAskNotification = JsonRpcNotification<"question.ask", QuestionAskPayload>;
export type MascotStateNotification = JsonRpcNotification<"mascot.state", MascotStatePayload>;
export type CostUpdateNotification = JsonRpcNotification<"cost.update", CostUpdatePayload>;
export type ErrorNotification = JsonRpcNotification<"error", ErrorEventPayload>;

export type JudgeVerdictNotification = JsonRpcNotification<"judge.verdict", JudgeVerdictPayload>;

// ---------------------------------------------------------------------------
// Phase 2a: sub-agent orchestration events. See ARCHITECTURE.md §3.3/§9.
// ---------------------------------------------------------------------------

export interface SubAgentBriefPayload {
	role: "researcher" | "coder" | "tester" | "reviewer";
	goal: string;
	inputs: Record<string, unknown>;
	constraints: string[];
	acceptance: string[];
	budget: { tokens: number; steps: number };
}

export interface SubAgentResultPayload {
	agentId: string;
	role: SubAgentBriefPayload["role"];
	ok: boolean;
	text: string;
	notes: string[];
	tokensUsed: number;
	stepsUsed: number;
	worktree?: { path: string; branch: string; diff: string } | null;
}

export interface SubAgentSpawnPayload {
	sessionId: string;
	agentId: string;
	role: SubAgentBriefPayload["role"];
	brief: SubAgentBriefPayload;
	status: string;
}

export interface SubAgentUpdatePayload {
	sessionId: string;
	agentId: string;
	role: SubAgentBriefPayload["role"];
	brief: SubAgentBriefPayload;
	status: string;
}

export interface SubAgentDonePayload {
	sessionId: string;
	agentId: string;
	role: SubAgentBriefPayload["role"];
	brief: SubAgentBriefPayload;
	status: string;
	result: SubAgentResultPayload | null;
}

export type SubAgentSpawnNotification = JsonRpcNotification<"subagent.spawn", SubAgentSpawnPayload>;
export type SubAgentUpdateNotification = JsonRpcNotification<"subagent.update", SubAgentUpdatePayload>;
export type SubAgentDoneNotification = JsonRpcNotification<"subagent.done", SubAgentDonePayload>;

// ---------------------------------------------------------------------------
// Phase 4: browser extension bridge + screen vision wire types.
// See ARCHITECTURE.md §14/§15/§21 Phase 4. Deliberately excludes the DOM
// automation, browser.test tool, and real vision capture/describe logic —
// those are Phase 4b/4c/4d.
// ---------------------------------------------------------------------------

export interface BridgeRegisterParams {
	role: "bridge";
}

export type BridgeRegisterResult = OkResult;

export type BridgeRegisterRequest = JsonRpcRequest<"bridge.register", BridgeRegisterParams>;

export interface BrowserAttachParams {
	[key: string]: never;
}

export interface BrowserAttachResult {
	attached: boolean;
	extensionVersion?: string;
}

export interface BrowserStatusParams {
	[key: string]: never;
}

export interface BrowserStatusResult {
	status: "disconnected" | "connected" | "error";
	error?: string;
}

export interface BrowserNavigateParams {
	sessionId: string;
	url: string;
}

export type BrowserNavigateResult = OkResult;

export type BrowserAction =
	| { type: "click"; selector: string }
	| { type: "type"; selector: string; text: string }
	| { type: "waitFor"; selector: string; timeoutMs?: number }
	| { type: "screenshot" };

export interface BrowserActParams {
	sessionId: string;
	action: BrowserAction;
}

export interface BrowserActResult {
	ok: boolean;
	error?: string;
}

export interface BrowserScreenshotParams {
	sessionId: string;
}

export interface BrowserScreenshotResult {
	dataUrl: string;
}

export type BrowserAttachRequest = JsonRpcRequest<"browser.attach", BrowserAttachParams>;
export type BrowserStatusRequest = JsonRpcRequest<"browser.status", BrowserStatusParams>;
export type BrowserNavigateRequest = JsonRpcRequest<"browser.navigate", BrowserNavigateParams>;
export type BrowserActRequest = JsonRpcRequest<"browser.act", BrowserActParams>;
export type BrowserScreenshotRequest = JsonRpcRequest<"browser.screenshot", BrowserScreenshotParams>;

export interface VisionCaptureParams {
	sessionId: string;
	region?: { x: number; y: number; w: number; h: number };
}

export interface VisionCaptureResult {
	frameId: string;
	path: string;
}

export interface VisionDescribeParams {
	sessionId: string;
	frameId: string;
	prompt?: string;
}

export interface VisionDescribeResult {
	text: string;
}

export type VisionCaptureRequest = JsonRpcRequest<"vision.capture", VisionCaptureParams>;
export type VisionDescribeRequest = JsonRpcRequest<"vision.describe", VisionDescribeParams>;

export interface BrowserCursorPayload {
	sessionId: string;
	x: number;
	y: number;
	action: "move" | "click";
}

export interface BrowserEventPayload {
	sessionId: string;
	kind: "navigated" | "error";
	detail: string;
}

export interface VisionFramePayload {
	sessionId: string;
	frameId: string;
	path: string;
}

export type BrowserCursorNotification = JsonRpcNotification<"browser.cursor", BrowserCursorPayload>;
export type BrowserEventNotification = JsonRpcNotification<"browser.event", BrowserEventPayload>;
export type VisionFrameNotification = JsonRpcNotification<"vision.frame", VisionFramePayload>;
