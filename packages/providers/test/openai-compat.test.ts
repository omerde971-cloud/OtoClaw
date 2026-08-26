import { afterEach, describe, expect, test } from "bun:test";
import { createOpenAICompatProvider } from "../src/openai-compat";
import type { ChatChunk } from "../src/types";

function sseStream(events: string[]): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	return new ReadableStream({
		start(controller) {
			for (const event of events) {
				controller.enqueue(encoder.encode(`data: ${event}\n\n`));
			}
			controller.close();
		},
	});
}

const originalFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("openai-compat provider", () => {
	test("chat streams text deltas from SSE and never touches the network directly", async () => {
		let capturedUrl = "";
		let capturedAuth: string | undefined;
		globalThis.fetch = (async (url: string, init?: RequestInit) => {
			capturedUrl = String(url);
			capturedAuth = (init?.headers as Record<string, string> | undefined)
				?.authorization;
			const body = sseStream([
				JSON.stringify({ choices: [{ delta: { content: "Hel" } }] }),
				JSON.stringify({ choices: [{ delta: { content: "lo" } }] }),
				JSON.stringify({ choices: [{ finish_reason: "stop" }] }),
				"[DONE]",
			]);
			return new Response(body, { status: 200 });
		}) as typeof fetch;

		const provider = createOpenAICompatProvider({
			id: "openrouter",
			baseUrl: "https://openrouter.ai/api/v1",
			apiKey: "sk-test",
		});

		const chunks: ChatChunk[] = [];
		for await (const chunk of provider.chat({
			model: "anthropic/claude-sonnet",
			messages: [{ role: "user", content: "hi" }],
		})) {
			chunks.push(chunk);
		}

		expect(capturedUrl).toBe("https://openrouter.ai/api/v1/chat/completions");
		expect(capturedAuth).toBe("Bearer sk-test");
		const text = chunks.map((c) => c.delta ?? "").join("");
		expect(text).toBe("Hello");
		expect(chunks.some((c) => c.done)).toBe(true);
	});

	test("chat streams incremental tool call arguments", async () => {
		globalThis.fetch = (async () => {
			const body = sseStream([
				JSON.stringify({
					choices: [
						{
							delta: {
								tool_calls: [
									{ index: 0, id: "call_1", function: { name: "fs.read" } },
								],
							},
						},
					],
				}),
				JSON.stringify({
					choices: [
						{
							delta: {
								tool_calls: [{ index: 0, function: { arguments: '{"path":' } }],
							},
						},
					],
				}),
				JSON.stringify({
					choices: [
						{
							delta: {
								tool_calls: [{ index: 0, function: { arguments: '"a.ts"}' } }],
							},
						},
					],
				}),
				"[DONE]",
			]);
			return new Response(body, { status: 200 });
		}) as typeof fetch;

		const provider = createOpenAICompatProvider({
			id: "openrouter",
			baseUrl: "https://x",
		});
		const chunks: ChatChunk[] = [];
		for await (const chunk of provider.chat({
			model: "m",
			messages: [{ role: "user", content: "read a.ts" }],
		})) {
			chunks.push(chunk);
		}

		const toolChunks = chunks.filter((c) => c.toolCall);
		expect(toolChunks).toHaveLength(3);
		expect(toolChunks[0]?.toolCall?.id).toBe("call_1");
		expect(toolChunks[0]?.toolCall?.name).toBe("fs.read");
		const args = toolChunks.map((c) => c.toolCall?.argsDelta ?? "").join("");
		expect(args).toBe('{"path":"a.ts"}');
	});

	test("listModels maps the /models response using known and fallback capabilities", async () => {
		globalThis.fetch = (async (url: string) => {
			expect(String(url)).toBe("https://x/models");
			return new Response(
				JSON.stringify({
					data: [{ id: "openai/gpt-4o" }, { id: "some/unknown-model" }],
				}),
				{ status: 200 },
			);
		}) as typeof fetch;

		const provider = createOpenAICompatProvider({
			id: "openrouter",
			baseUrl: "https://x",
		});
		const models = await provider.listModels();
		expect(models).toHaveLength(2);
		expect(models[0]?.contextWindow).toBe(128_000);
		expect(models[1]?.contextWindow).toBe(8000);
	});

	test("capabilities falls back for unknown models", () => {
		const provider = createOpenAICompatProvider({
			id: "openrouter",
			baseUrl: "https://x",
		});
		expect(provider.capabilities("openai/gpt-4o")).toEqual({
			tools: true,
			vision: true,
			ctx: 128_000,
		});
		expect(provider.capabilities("totally/unknown")).toEqual({
			tools: true,
			vision: false,
			ctx: 8000,
		});
	});
});
