export interface Session {
	id: string;
	cwd: string;
	mode: "manual" | "auto";
	createdAt: string;
}

export interface Message {
	id: string;
	sessionId: string;
	role: "user" | "assistant" | "system";
	content: string;
	createdAt: string;
}

export type PipelineStage = "intake" | "plan" | "route" | "execute" | "review" | "deliver";

export type TaskStatus = "pending" | "running" | "blocked" | "done" | "failed";

export interface Task {
	id: string;
	sessionId: string;
	userText: string;
	stage: PipelineStage;
	status: TaskStatus;
	createdAt: string;
	updatedAt: string;
}

export interface ToolCall {
	id: string;
	sessionId: string;
	taskId?: string;
	name: string;
	args: unknown;
	result?: { ok: boolean; value?: unknown; error?: string };
	risk?: { score: number; reasons: string[] };
	createdAt: string;
}

// TODO: Phase 2 — judge verdict record (score, label, notes)
export interface Verdict {
	id: string;
	targetId: string;
	score: number;
	label: "good" | "bad";
	notes: string[];
	createdAt: string;
}

export type SubAgentStatus = "spawned" | "running" | "done" | "failed";

// ARCHITECTURE.md §9 — one spawned sub-agent's record, keyed by the task that spawned it.
export interface SubAgentRun {
	id: string;
	parentTaskId: string;
	role: "researcher" | "coder" | "tester" | "reviewer";
	status: SubAgentStatus;
	budget: { tokens: number; steps: number };
	result?: {
		ok: boolean;
		text: string;
		notes: string[];
		tokensUsed: number;
		stepsUsed: number;
		worktree?: { path: string; branch: string; diff: string } | null;
	} | null;
	createdAt: string;
	updatedAt: string;
}
