import type { ChatChunk, ChatRequest, ModelCapabilities, ModelInfo, Provider } from "@otoclaw/providers";

/**
 * Deterministic, scripted Provider for tests. Each call to chat() consumes the next entry in
 * the script (a list of chunks to yield); calling past the end of the script re-yields the
 * last entry so an over-eager caller doesn't crash the test, it just keeps "talking".
 * Never touches the network — required for automated tests per project policy.
 */
export class StubProvider implements Provider {
	readonly id = "stub";
	private callIndex = 0;
	readonly requests: ChatRequest[] = [];

	constructor(private readonly script: ChatChunk[][]) {}

	async listModels(): Promise<ModelInfo[]> {
		return [];
	}

	capabilities(): ModelCapabilities {
		return { tools: true, vision: false, ctx: 8000 };
	}

	chat(req: ChatRequest): AsyncIterable<ChatChunk> {
		this.requests.push(req);
		const index = Math.min(this.callIndex, this.script.length - 1);
		this.callIndex++;
		const chunks = this.script[index] ?? [];
		return (async function* () {
			for (const chunk of chunks) yield chunk;
		})();
	}
}
