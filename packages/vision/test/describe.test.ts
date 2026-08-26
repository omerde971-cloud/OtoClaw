import { afterEach, beforeEach, describe as bunDescribe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
	ChatChunk,
	ChatRequest,
	ModelCapabilities,
	ModelInfo,
	Provider,
} from "@otoclaw/providers";
import { describe } from "../src/describe";

const FRAME_BYTES = Buffer.from("fake-png-bytes");

/**
 * Deterministic, scripted Provider for tests — mirrors packages/agent/test/support/stub-provider.ts.
 * Never touches the network.
 */
class StubProvider implements Provider {
	readonly id = "stub";
	readonly requests: ChatRequest[] = [];

	constructor(private readonly chunks: ChatChunk[]) {}

	async listModels(): Promise<ModelInfo[]> {
		return [];
	}

	capabilities(): ModelCapabilities {
		return { tools: true, vision: true, ctx: 8000 };
	}

	chat(req: ChatRequest): AsyncIterable<ChatChunk> {
		this.requests.push(req);
		const chunks = this.chunks;
		return (async function* () {
			for (const chunk of chunks) yield chunk;
		})();
	}
}

let fakeHome: string;
let originalUserProfile: string | undefined;
let originalHome: string | undefined;
let frameId: string;

beforeEach(async () => {
	fakeHome = await mkdtemp(join(tmpdir(), "otoclaw-vision-test-"));
	originalUserProfile = process.env.USERPROFILE;
	originalHome = process.env.HOME;
	process.env.USERPROFILE = fakeHome;
	process.env.HOME = fakeHome;

	frameId = "frame-123";
	const dir = join(fakeHome, ".otoclaw", "cache", "vision");
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, `${frameId}.png`), FRAME_BYTES);
});

afterEach(async () => {
	process.env.USERPROFILE = originalUserProfile;
	process.env.HOME = originalHome;
	await rm(fakeHome, { recursive: true, force: true });
});

bunDescribe("describe", () => {
	test("sends the frame as base64 image content plus the prompt, and parses the reply text", async () => {
		const provider = new StubProvider([
			{ delta: "There is " },
			{ delta: "a browser window open." },
			{ done: true },
		]);

		const result = await describe(
			{ sessionId: "s1", frameId, prompt: "What is on screen?" },
			async () => ({ provider, model: "some-model" }),
		);

		expect(result.text).toBe("There is a browser window open.");
		expect(provider.requests).toHaveLength(1);

		const [request] = provider.requests;
		expect(request?.model).toBe("some-model");
		expect(request?.messages).toHaveLength(1);

		const message = request?.messages[0];
		expect(message?.role).toBe("user");
		expect(Array.isArray(message?.content)).toBe(true);

		const parts = message?.content as Array<{
			type: string;
			text?: string;
			data?: string;
			mimeType?: string;
		}>;
		expect(parts).toEqual([
			{ type: "text", text: "What is on screen?" },
			{
				type: "image",
				data: FRAME_BYTES.toString("base64"),
				mimeType: "image/png",
			},
		]);
	});

	test("falls back to a default prompt when none is given", async () => {
		const provider = new StubProvider([{ delta: "ok" }, { done: true }]);

		await describe({ sessionId: "s1", frameId }, async () => ({
			provider,
			model: "some-model",
		}));

		const parts = provider.requests[0]?.messages[0]?.content as Array<{
			type: string;
			text?: string;
		}>;
		expect(parts[0]?.type).toBe("text");
		expect(typeof parts[0]?.text).toBe("string");
		expect(parts[0]?.text?.length).toBeGreaterThan(0);
	});

	test("rejects when no resolveProvider is configured", async () => {
		await expect(describe({ sessionId: "s1", frameId })).rejects.toThrow(
			/vision provider/i,
		);
	});
});
