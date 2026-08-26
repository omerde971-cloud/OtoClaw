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

// TODO: Phase 1 — full Task lifecycle (pipeline stages, status, owner)
export interface Task {
	id: string;
	sessionId: string;
}

// TODO: Phase 1 — tool invocation record (name, args, result, risk)
export interface ToolCall {
	id: string;
	sessionId: string;
}

// TODO: Phase 2 — judge verdict record (score, label, notes)
export interface Verdict {
	id: string;
	targetId: string;
}
