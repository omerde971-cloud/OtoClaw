import { describe, expect, test } from "bun:test";
import {
	CliNotAvailableError,
	createCliDelegateProvider,
} from "../src/cli-delegate";

function fakeStdout(chunks: string[]): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	return new ReadableStream({
		start(controller) {
			for (const chunk of chunks) {
				controller.enqueue(encoder.encode(chunk));
			}
			controller.close();
		},
	});
}

async function collect(
	iter: AsyncIterable<{ delta?: string; done?: boolean }>,
): Promise<{ deltas: string[]; done: boolean }> {
	const deltas: string[] = [];
	let done = false;
	for await (const chunk of iter) {
		if (chunk.delta) deltas.push(chunk.delta);
		if (chunk.done) done = true;
	}
	return { deltas, done };
}

describe("createCliDelegateProvider", () => {
	test("streams stdout chunks as ChatChunk deltas when the binary is available", async () => {
		const calls: Array<{ cmd: string[]; options?: unknown }> = [];
		const provider = createCliDelegateProvider({
			binary: "claude",
			whichImpl: () => "/usr/local/bin/claude",
			spawnImpl: (cmd, options) => {
				calls.push({ cmd, options });
				return {
					stdout: fakeStdout(["hello ", "world"]),
					exited: Promise.resolve(0),
				};
			},
		});

		const { deltas, done } = await collect(
			provider.chat({
				model: "cli-default",
				messages: [{ role: "user", content: "hi" }],
			}),
		);

		expect(deltas).toEqual(["hello ", "world"]);
		expect(done).toBe(true);
		expect(calls).toHaveLength(1);
		expect(calls[0]?.cmd[0]).toBe("claude");
		expect(calls[0]?.cmd).toContain("-p");
		expect(calls[0]?.cmd).toContain("--output-format");
	});

	test("builds codex exec args", async () => {
		const calls: string[][] = [];
		const provider = createCliDelegateProvider({
			binary: "codex",
			whichImpl: () => "/usr/local/bin/codex",
			spawnImpl: (cmd) => {
				calls.push(cmd);
				return { stdout: fakeStdout([]), exited: Promise.resolve(0) };
			},
		});

		await collect(
			provider.chat({
				model: "cli-default",
				messages: [{ role: "user", content: "hi" }],
			}),
		);

		expect(calls[0]?.[0]).toBe("codex");
		expect(calls[0]?.[1]).toBe("exec");
	});

	test("throws CliNotAvailableError instead of crashing when the binary is missing", async () => {
		const provider = createCliDelegateProvider({
			binary: "claude",
			whichImpl: () => null,
			spawnImpl: () => {
				throw new Error("spawnImpl should not be called when binary is missing");
			},
		});

		const iter = provider.chat({
			model: "cli-default",
			messages: [{ role: "user", content: "hi" }],
		})[Symbol.asyncIterator]();

		await expect(iter.next()).rejects.toBeInstanceOf(CliNotAvailableError);
	});

	test("listModels returns a single placeholder model", async () => {
		const provider = createCliDelegateProvider({
			binary: "claude",
			whichImpl: () => "/usr/local/bin/claude",
		});
		const models = await provider.listModels();
		expect(models).toHaveLength(1);
		expect(models[0]?.provider).toBe("claude");
		expect(models[0]?.supportsTools).toBe(false);
		expect(models[0]?.supportsVision).toBe(false);
	});

	test("capabilities report no tool/vision support", () => {
		const provider = createCliDelegateProvider({ binary: "claude" });
		expect(provider.capabilities("cli-default")).toEqual({
			tools: false,
			vision: false,
			ctx: 200_000,
		});
	});
});
