import type { Config, PipelineStage, Policy, Session } from "@otoclaw/shared";
import type { PermissionEngine, RiskScore, SessionOverrides } from "@otoclaw/permission";
import type { Provider } from "@otoclaw/providers";
import type { ToolContext, ToolRegistry, ToolResult } from "@otoclaw/tools";

export type { PipelineStage };

export interface TaskIntake {
	userText: string;
	clarification?: string;
}

export interface PlanStep {
	id: string;
	description: string;
	kind: "tool" | "code";
	acceptance: string[];
	/**
	 * Explicit routing request from the planner. Phase 1 only implements the "tool"
	 * route — a "subagent" request is a deliberate scope boundary, rejected by router().
	 */
	requestedRoute?: "tool" | "subagent";
}

export interface Plan {
	steps: PlanStep[];
}

export interface QuestionOption {
	id: string;
	label: string;
	description?: string;
}

export interface QuestionSpec {
	questionId: string;
	header: string;
	question: string;
	options: QuestionOption[];
	allowFreeText?: boolean;
	multiSelect?: boolean;
}

export interface QuestionAnswer {
	optionId?: string;
	freeText?: string;
}

/** Blocking-question interface. No real implementation in Phase 1 — daemon/CLI wire it later. */
export interface QuestionChannel {
	ask(spec: QuestionSpec): Promise<QuestionAnswer>;
}

export interface PermissionRequest {
	toolCallId: string;
	toolName: string;
	args: unknown;
	risk: RiskScore;
}

/** Gate for `ask`/escalated permission decisions. No real implementation in Phase 1. */
export interface PermissionChannel {
	request(input: PermissionRequest): Promise<"allow" | "deny">;
}

export interface AgentEventMap {
	"pipeline.stage": { stage: PipelineStage; detail?: string };
	"stream.delta": { text: string };
	"tool.start": { toolCallId: string; name: string; args: unknown };
	"tool.end": { toolCallId: string; name: string; result: ToolResult };
	"permission.request": { toolCallId: string; tool: string; args: unknown; risk: RiskScore };
	"review.result": { passed: boolean; notes: string[] };
	error: { code: string; message: string; recoverable: boolean };
}

export type AgentEventName = keyof AgentEventMap;

/** Typed emitter contract. Real WS bridging is Phase 1d — this stays in-process. */
export interface AgentEvents {
	emit<K extends AgentEventName>(event: K, payload: AgentEventMap[K]): void;
	on<K extends AgentEventName>(event: K, listener: (payload: AgentEventMap[K]) => void): void;
	off<K extends AgentEventName>(event: K, listener: (payload: AgentEventMap[K]) => void): void;
}

export interface RunContext {
	session: Session;
	provider: Provider;
	model: string;
	toolRegistry: ToolRegistry;
	toolContext: ToolContext;
	permissionEngine: PermissionEngine;
	mode: "manual" | "auto";
	sessionOverrides?: SessionOverrides;
	projectPolicy?: Policy | null;
	globalConfig?: Config | null;
	questionChannel: QuestionChannel;
	permissionChannel: PermissionChannel;
	events: AgentEvents;
	signal?: AbortSignal;
}
