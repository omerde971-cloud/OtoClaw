import type {
	ChatChunk,
	ChatRequest,
	ModelCapabilities,
	ModelInfo,
	Provider,
} from "./types";

export interface AnthropicOptions {
	baseUrl?: string;
	apiKey?: string;
	apiVersion?: string;
}

const KNOWN_CAPABILITIES: Record<string, ModelCapabilities> = {
	"claude-sonnet-4-5": { tools: true, vision: true, ctx: 200_000 },
	"claude-opus-4-1": { tools: true, vision: true, ctx: 200_000 },
	"claude-3-5-haiku-latest": { tools: true, vision: true, ctx: 200_000 },
};

const FALLBACK_CAPABILITIES: ModelCapabilities = {
	tools: true,
	vision: false,
	ctx: 8000,
};

const DEFAULT_BASE_URL = "https://api.anthropic.com/v1";
const DEFAULT_API_VERSION = "2023-06-01";

interface AnthropicStreamEvent {
	type: string;
	index?: number;
	content_block?: { type: string; id?: string; name?: string };
	delta?: { type: string; text?: string; partial_json?: string };
	usage?: { input_tokens?: number; output_tokens?: number };
	message?: { usage?: { input_tokens?: number; output_tokens?: number } };
}

async function* parseSSE(
	body: ReadableStream<Uint8Array>,
): AsyncIterable<string> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	try {
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			let separatorIndex = buffer.indexOf("\n\n");
			while (separatorIndex !== -1) {
				const rawEvent = buffer.slice(0, separatorIndex);
				buffer = buffer.slice(separatorIndex + 2);
				for (const line of rawEvent.split("\n")) {
					const trimmed = line.trim();
					if (trimmed.startsWith("data:")) {
						yield trimmed.slice("data:".length).trim();
					}
				}
				separatorIndex = buffer.indexOf("\n\n");
			}
		}
	} finally {
		reader.releaseLock();
	}
}

export function createAnthropicProvider(
	options: AnthropicOptions = {},
): Provider {
	const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
	const apiVersion = options.apiVersion ?? DEFAULT_API_VERSION;
	const apiKey = options.apiKey;

	function headers(): Record<string, string> {
		const h: Record<string, string> = {
			"content-type": "application/json",
			"anthropic-version": apiVersion,
		};
		if (apiKey) h["x-api-key"] = apiKey;
		return h;
	}

	return {
		id: "anthropic",

		async listModels(): Promise<ModelInfo[]> {
			return Object.entries(KNOWN_CAPABILITIES).map(([modelId, caps]) => ({
				id: modelId,
				provider: "anthropic",
				contextWindow: caps.ctx,
				supportsTools: caps.tools,
				supportsVision: caps.vision,
			}));
		},

		async *chat(req: ChatRequest): AsyncIterable<ChatChunk> {
			const system = req.messages.find((m) => m.role === "system")?.content;
			const messages = req.messages
				.filter((m) => m.role !== "system")
				.map((m) => {
					if (m.role === "tool") {
						return {
							role: "user" as const,
							content: [
								{
									type: "tool_result",
									tool_use_id: m.toolCallId,
									content: m.content,
								},
							],
						};
					}
					if (m.toolCalls?.length) {
						return {
							role: "assistant" as const,
							content: [
								...(m.content ? [{ type: "text", text: m.content }] : []),
								...m.toolCalls.map((tc) => ({
									type: "tool_use",
									id: tc.id,
									name: tc.name,
									input: tc.args ? JSON.parse(tc.args) : {},
								})),
							],
						};
					}
					return { role: m.role as "user" | "assistant", content: m.content };
				});

			const res = await fetch(`${baseUrl}/messages`, {
				method: "POST",
				headers: headers(),
				signal: req.signal,
				body: JSON.stringify({
					model: req.model,
					stream: true,
					max_tokens: 4096,
					temperature: req.temperature,
					...(system ? { system } : {}),
					messages,
					...(req.tools
						? {
								tools: req.tools.map((t) => ({
									name: t.name,
									description: t.description,
									input_schema: t.parameters,
								})),
							}
						: {}),
				}),
			});
			if (!res.ok || !res.body) {
				throw new Error(`anthropic: chat failed with status ${res.status}`);
			}

			const blockTypes = new Map<number, string>();
			const toolIds = new Map<number, string>();
			const toolNames = new Map<number, string>();

			for await (const data of parseSSE(res.body)) {
				const event = JSON.parse(data) as AnthropicStreamEvent;

				if (
					event.type === "content_block_start" &&
					event.index !== undefined &&
					event.content_block
				) {
					blockTypes.set(event.index, event.content_block.type);
					if (event.content_block.type === "tool_use") {
						toolIds.set(event.index, event.content_block.id ?? "");
						toolNames.set(event.index, event.content_block.name ?? "");
					}
					continue;
				}

				if (
					event.type === "content_block_delta" &&
					event.index !== undefined &&
					event.delta
				) {
					const blockType = blockTypes.get(event.index);
					if (event.delta.type === "text_delta" && event.delta.text) {
						yield { delta: event.delta.text };
					} else if (
						blockType === "tool_use" &&
						event.delta.type === "input_json_delta"
					) {
						yield {
							toolCall: {
								id: toolIds.get(event.index) ?? "",
								name: toolNames.get(event.index) ?? "",
								argsDelta: event.delta.partial_json ?? "",
							},
						};
					}
					continue;
				}

				if (event.type === "message_delta" && event.usage) {
					yield {
						usage: {
							in: event.usage.input_tokens ?? 0,
							out: event.usage.output_tokens ?? 0,
						},
					};
					continue;
				}

				if (event.type === "message_stop") {
					yield { done: true };
				}
			}
		},

		capabilities(model: string): ModelCapabilities {
			return KNOWN_CAPABILITIES[model] ?? FALLBACK_CAPABILITIES;
		},
	};
}
