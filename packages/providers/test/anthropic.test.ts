import { afterEach, describe, expect, test } from "bun:test";
import { createAnthropicProvider } from "../src/anthropic";
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

describe("anthropic provider", () => {
	test("chat streams text deltas from content_block_delta events", async () => {
		let capturedUrl = "";
		let capturedKeyHeader: string | undefined;
		globalThis.fetch = (async (url: string, init?: RequestInit) => {
			capturedUrl = String(url);
			capturedKeyHeader = (
				init?.headers as Record<string, string> | undefined
			)?.["x-api-key"];
			const body = sseStream([
				JSON.stringify({
					type: "content_block_start",
					index: 0,
					content_block: { type: "text" },
				}),
				JSON.stringify({
					type: "content_block_delta",
					index: 0,
					delta: { type: "text_delta", text: "Hel" },
				}),
				JSON.stringify({
					type: "content_block_delta",
					index: 0,
					delta: { type: "text_delta", text: "lo" },
				}),
				JSON.stringify({ type: "content_block_stop", index: 0 }),
				JSON.stringify({
					type: "message_delta",
					usage: { input_tokens: 5, output_tokens: 2 },
				}),
				JSON.stringify({ type: "message_stop" }),
			]);
			return new Response(body, { status: 200 });
		}) as typeof fetch;

		const provider = createAnthropicProvider({ apiKey: "sk-ant-test" });
		const chunks: ChatChunk[] = [];
		for await (const chunk of provider.chat({
			model: "claude-sonnet-4-5",
			messages: [{ role: "user", content: "hi" }],
		})) {
			chunks.push(chunk);
		}

		expect(capturedUrl).toBe("https://api.anthropic.com/v1/messages");
		expect(capturedKeyHeader).toBe("sk-ant-test");
		const text = chunks.map((c) => c.delta ?? "").join("");
		expect(text).toBe("Hello");
		expect(chunks.some((c) => c.usage?.in === 5 && c.usage?.out === 2)).toBe(
			true,
		);
		expect(chunks.some((c) => c.done)).toBe(true);
	});

	test("chat streams tool_use blocks as incremental tool calls", async () => {
		globalThis.fetch = (async () => {
			const body = sseStream([
				JSON.stringify({
					type: "content_block_start",
					index: 0,
					content_block: { type: "tool_use", id: "toolu_1", name: "fs.read" },
				}),
				JSON.stringify({
					type: "content_block_delta",
					index: 0,
					delta: { type: "input_json_delta", partial_json: '{"path":' },
				}),
				JSON.stringify({
					type: "content_block_delta",
					index: 0,
					delta: { type: "input_json_delta", partial_json: '"a.ts"}' },
				}),
				JSON.stringify({ type: "content_block_stop", index: 0 }),
				JSON.stringify({ type: "message_stop" }),
			]);
			return new Response(body, { status: 200 });
		}) as typeof fetch;

		const provider = createAnthropicProvider({ apiKey: "sk-ant-test" });
		const chunks: ChatChunk[] = [];
		for await (const chunk of provider.chat({
			model: "claude-sonnet-4-5",
			messages: [{ role: "user", content: "read a.ts" }],
		})) {
			chunks.push(chunk);
		}

		const toolChunks = chunks.filter((c) => c.toolCall);
		expect(toolChunks).toHaveLength(2);
		expect(toolChunks[0]?.toolCall?.id).toBe("toolu_1");
		expect(toolChunks[0]?.toolCall?.name).toBe("fs.read");
		const args = toolChunks.map((c) => c.toolCall?.argsDelta ?? "").join("");
		expect(args).toBe('{"path":"a.ts"}');
	});

	test("capabilities returns known table entries and a safe fallback", () => {
		const provider = createAnthropicProvider();
		expect(provider.capabilities("claude-sonnet-4-5")).toEqual({
			tools: true,
			vision: true,
			ctx: 200_000,
		});
		expect(provider.capabilities("some-unknown-model")).toEqual({
			tools: true,
			vision: false,
			ctx: 8000,
		});
	});

	test("listModels never issues a network call", async () => {
		let called = false;
		globalThis.fetch = (async () => {
			called = true;
			return new Response("{}", { status: 200 });
		}) as typeof fetch;

		const provider = createAnthropicProvider();
		const models = await provider.listModels();
		expect(called).toBe(false);
		expect(models.length).toBeGreaterThan(0);
	});
});
