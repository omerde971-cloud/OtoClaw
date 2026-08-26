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

export interface Verdict {
	id: string;
	targetId: string;
	score: number;
	label: "good" | "bad";
	notes: string[];
	createdAt: string;
}
