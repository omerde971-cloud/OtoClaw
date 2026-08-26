import type {
	ChatChunk,
	ChatRequest,
	ModelCapabilities,
	ModelInfo,
	Provider,
} from "./types";

export interface OpenAICompatOptions {
	id: string;
	baseUrl: string;
	apiKey?: string;
}

const KNOWN_CAPABILITIES: Record<string, ModelCapabilities> = {
	"openai/gpt-4o": { tools: true, vision: true, ctx: 128_000 },
	"openai/gpt-4o-mini": { tools: true, vision: true, ctx: 128_000 },
	"meta-llama/llama-3.1-70b-instruct": {
		tools: true,
		vision: false,
		ctx: 128_000,
	},
	"anthropic/claude-sonnet": { tools: true, vision: true, ctx: 200_000 },
};

const FALLBACK_CAPABILITIES: ModelCapabilities = {
	tools: true,
	vision: false,
	ctx: 8000,
};

interface OpenAIStreamDelta {
	content?: string;
	tool_calls?: Array<{
		index: number;
		id?: string;
		function?: { name?: string; arguments?: string };
	}>;
}

interface OpenAIStreamChunk {
	choices?: Array<{ delta?: OpenAIStreamDelta; finish_reason?: string | null }>;
	usage?: { prompt_tokens?: number; completion_tokens?: number };
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

export function createOpenAICompatProvider(
	options: OpenAICompatOptions,
): Provider {
	const { id, baseUrl, apiKey } = options;

	function headers(): Record<string, string> {
		const h: Record<string, string> = { "content-type": "application/json" };
		if (apiKey) h.authorization = `Bearer ${apiKey}`;
		return h;
	}

	return {
		id,

		async listModels(): Promise<ModelInfo[]> {
			const res = await fetch(`${baseUrl}/models`, { headers: headers() });
			if (!res.ok)
				throw new Error(`${id}: listModels failed with status ${res.status}`);
			const body = (await res.json()) as { data?: Array<{ id: string }> };
			return (body.data ?? []).map((m) => {
				const caps = KNOWN_CAPABILITIES[m.id] ?? FALLBACK_CAPABILITIES;
				return {
					id: m.id,
					provider: id,
					contextWindow: caps.ctx,
					supportsTools: caps.tools,
					supportsVision: caps.vision,
				};
			});
		},

		async *chat(req: ChatRequest): AsyncIterable<ChatChunk> {
			const res = await fetch(`${baseUrl}/chat/completions`, {
				method: "POST",
				headers: headers(),
				signal: req.signal,
				body: JSON.stringify({
					model: req.model,
					stream: true,
					temperature: req.temperature,
					messages: req.messages.map((m) => ({
						role: m.role,
						content: m.content,
						tool_call_id: m.toolCallId,
						...(m.toolCalls
							? {
									tool_calls: m.toolCalls.map((tc) => ({
										id: tc.id,
										type: "function",
										function: { name: tc.name, arguments: tc.args },
									})),
								}
							: {}),
					})),
					...(req.tools
						? {
								tools: req.tools.map((t) => ({
									type: "function",
									function: {
										name: t.name,
										description: t.description,
										parameters: t.parameters,
									},
								})),
							}
						: {}),
				}),
			});
			if (!res.ok || !res.body) {
				throw new Error(`${id}: chat failed with status ${res.status}`);
			}

			const toolCallIds = new Map<number, string>();
			const toolCallNames = new Map<number, string>();

			for await (const data of parseSSE(res.body)) {
				if (data === "[DONE]") {
					yield { done: true };
					continue;
				}
				const chunk = JSON.parse(data) as OpenAIStreamChunk;
				const choice = chunk.choices?.[0];
				const delta = choice?.delta;

				if (delta?.content) {
					yield { delta: delta.content };
				}

				for (const tc of delta?.tool_calls ?? []) {
					if (tc.id) toolCallIds.set(tc.index, tc.id);
					if (tc.function?.name) toolCallNames.set(tc.index, tc.function.name);
					const id2 = toolCallIds.get(tc.index) ?? "";
					const name = toolCallNames.get(tc.index) ?? "";
					yield {
						toolCall: {
							id: id2,
							name,
							argsDelta: tc.function?.arguments ?? "",
						},
					};
				}

				if (chunk.usage) {
					yield {
						usage: {
							in: chunk.usage.prompt_tokens ?? 0,
							out: chunk.usage.completion_tokens ?? 0,
						},
					};
				}

				if (choice?.finish_reason) {
					yield { done: true };
				}
			}
		},

		capabilities(model: string): ModelCapabilities {
			return KNOWN_CAPABILITIES[model] ?? FALLBACK_CAPABILITIES;
		},
	};
}
