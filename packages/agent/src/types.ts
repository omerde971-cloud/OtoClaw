import type { Config, PipelineStage, Policy, Session, Verdict } from "@otoclaw/shared";
import type { PermissionEngine, RiskScore, SessionOverrides } from "@otoclaw/permission";
import type { Provider } from "@otoclaw/providers";
import type { ToolContext, ToolRegistry, ToolResult } from "@otoclaw/tools";
import type { Semaphore } from "./subagents";

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
	/** Explicit routing request from the planner. "subagent" spawns an isolated sub-agent (§9). */
	requestedRoute?: "tool" | "subagent";
	/** Sub-agent role when requestedRoute is "subagent"; router() defaults to "coder" if omitted. */
	role?: SubAgentBrief["role"];
}

export interface Plan {
	steps: PlanStep[];
}

/** ARCHITECTURE.md §9 — a precise, structured task handed to a sub-agent, not a vague prompt. */
export interface SubAgentBrief {
	role: "researcher" | "coder" | "tester" | "reviewer";
	goal: string;
	inputs: Record<string, unknown>;
	constraints: string[];
	acceptance: string[];
	budget: { tokens: number; steps: number };
}

export interface SubAgentResult {
	agentId: string;
	role: SubAgentBrief["role"];
	ok: boolean;
	text: string;
	notes: string[];
	tokensUsed: number;
	stepsUsed: number;
	/** Set only for worktree-isolated (role "coder") sub-agents that produced changes; never merged automatically. */
	worktree?: { path: string; branch: string; diff: string } | null;
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
	"subagent.spawn": { agentId: string; role: SubAgentBrief["role"]; brief: SubAgentBrief; status: string };
	"subagent.update": { agentId: string; role: SubAgentBrief["role"]; brief: SubAgentBrief; status: string };
	"subagent.done": {
		agentId: string;
		role: SubAgentBrief["role"];
		brief: SubAgentBrief;
		status: string;
		result: SubAgentResult | null;
	};
	"judge.verdict": Verdict;
	error: { code: string; message: string; recoverable: boolean };
}

export type AgentEventName = keyof AgentEventMap;

/** Typed emitter contract. Real WS bridging is Phase 1d — this stays in-process. */
export interface AgentEvents {
	emit<K extends AgentEventName>(event: K, payload: AgentEventMap[K]): void;
	on<K extends AgentEventName>(event: K, listener: (payload: AgentEventMap[K]) => void): void;
	off<K extends AgentEventName>(event: K, listener: (payload: AgentEventMap[K]) => void): void;
}

/**
 * Structural handle for @otoclaw/skills' SkillRegistry — kept local to avoid a circular
 * package dependency (skills depends on agent for QuestionChannel).
 */
export interface SkillRegistryHandle {
	match(taskText: string): Array<{ manifest: { name: string; description: string } }>;
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
	/** Shared concurrency-cap semaphore for sub-agent spawns within this run (ARCHITECTURE.md §9). */
	subAgentPool?: Semaphore;
	/** Phase 2c: optional skill registry handle. No forced integration into the loop yet. */
	skillRegistry?: SkillRegistryHandle;
}
