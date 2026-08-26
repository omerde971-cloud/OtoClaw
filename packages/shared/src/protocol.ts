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
// judge.verdict, mcp.* — those are Phase 2+.
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

export type StreamDeltaNotification = JsonRpcNotification<"stream.delta", StreamDeltaPayload>;
export type PipelineStageNotification = JsonRpcNotification<"pipeline.stage", PipelineStagePayload>;
export type ToolStartNotification = JsonRpcNotification<"tool.start", ToolStartPayload>;
export type ToolEndNotification = JsonRpcNotification<"tool.end", ToolEndPayload>;
export type PermissionRequestNotification = JsonRpcNotification<"permission.request", PermissionRequestPayload>;
export type QuestionAskNotification = JsonRpcNotification<"question.ask", QuestionAskPayload>;
export type MascotStateNotification = JsonRpcNotification<"mascot.state", MascotStatePayload>;
export type CostUpdateNotification = JsonRpcNotification<"cost.update", CostUpdatePayload>;
export type ErrorNotification = JsonRpcNotification<"error", ErrorEventPayload>;
