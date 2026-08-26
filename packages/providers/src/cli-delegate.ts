import type {
	ChatChunk,
	ChatMessage,
	ChatRequest,
	ModelCapabilities,
	ModelInfo,
	Provider,
} from "./types";

export type CliDelegateBinary = "claude" | "codex";

export class CliNotAvailableError extends Error {
	constructor(public readonly binary: string) {
		super(`"${binary}" CLI not found on PATH`);
		this.name = "CliNotAvailableError";
	}
}

export type CliSpawnFn = (
	cmd: string[],
	options?: { stdout?: "pipe"; stderr?: "pipe" },
) => {
	stdout: ReadableStream<Uint8Array>;
	exited: Promise<number>;
};

export type CliWhichFn = (bin: string) => string | null;

export interface CliDelegateOptions {
	binary: CliDelegateBinary;
	id?: string;
	spawnImpl?: CliSpawnFn;
	whichImpl?: CliWhichFn;
}

const CONTEXT_WINDOW = 200_000;

function defaultWhich(bin: string): string | null {
	return Bun.which(bin);
}

function defaultSpawn(
	cmd: string[],
	options?: { stdout?: "pipe"; stderr?: "pipe" },
) {
	return Bun.spawn(cmd, options);
}

function buildPrompt(messages: ChatMessage[]): string {
	return messages
		.map((m) => {
			const text =
				typeof m.content === "string"
					? m.content
					: m.content
							.filter((p): p is { type: "text"; text: string } => p.type === "text")
							.map((p) => p.text)
							.join("\n");
			return `${m.role}: ${text}`;
		})
		.join("\n\n");
}

function buildArgs(binary: CliDelegateBinary, prompt: string): string[] {
	if (binary === "claude") {
		return [binary, "-p", prompt, "--output-format", "text"];
	}
	return [binary, "exec", prompt];
}

export function createCliDelegateProvider(
	options: CliDelegateOptions,
): Provider {
	const { binary } = options;
	const id = options.id ?? binary;
	const spawnImpl = options.spawnImpl ?? defaultSpawn;
	const whichImpl = options.whichImpl ?? defaultWhich;

	const modelId = "cli-default";

	return {
		id,

		async listModels(): Promise<ModelInfo[]> {
			return [
				{
					id: modelId,
					provider: binary,
					contextWindow: CONTEXT_WINDOW,
					supportsTools: false,
					supportsVision: false,
				},
			];
		},

		async *chat(req: ChatRequest): AsyncIterable<ChatChunk> {
			const resolved = whichImpl(binary);
			if (!resolved) {
				throw new CliNotAvailableError(binary);
			}

			const prompt = buildPrompt(req.messages);
			const args = buildArgs(binary, prompt);
			const proc = spawnImpl(args, { stdout: "pipe" });

			const reader = proc.stdout.getReader();
			const decoder = new TextDecoder();
			try {
				while (true) {
					const { value, done } = await reader.read();
					if (done) break;
					const text = decoder.decode(value, { stream: true });
					if (text) yield { delta: text };
				}
			} finally {
				reader.releaseLock();
			}

			await proc.exited;
			yield { done: true };
		},

		capabilities(_model: string): ModelCapabilities {
			return { tools: false, vision: false, ctx: CONTEXT_WINDOW };
		},
	};
}
