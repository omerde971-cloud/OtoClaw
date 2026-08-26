export interface ChatMessage {
	role: "user" | "assistant" | "system" | "tool";
	content: string;
	toolCallId?: string;
	toolCalls?: Array<{ id: string; name: string; args: string }>;
}

export interface ToolSchema {
	name: string;
	description: string;
	parameters: Record<string, unknown>; // JSON schema
}

export interface ChatRequest {
	model: string;
	messages: ChatMessage[];
	tools?: ToolSchema[];
	temperature?: number;
	signal?: AbortSignal;
}

export interface ChatChunk {
	delta?: string;
	toolCall?: { id: string; name: string; argsDelta: string };
	usage?: { in: number; out: number };
	done?: boolean;
}

export interface ModelInfo {
	id: string;
	provider: string;
	contextWindow: number;
	supportsTools: boolean;
	supportsVision: boolean;
}

export interface ModelCapabilities {
	tools: boolean;
	vision: boolean;
	ctx: number;
}

export interface Provider {
	id: string;
	listModels(): Promise<ModelInfo[]>;
	chat(req: ChatRequest): AsyncIterable<ChatChunk>;
	capabilities(model: string): ModelCapabilities;
}

export type ProviderId =
	| "anthropic"
	| "openai-compat"
	| "gemini"
	| "cli-delegate";
