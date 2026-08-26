import { afterAll, expect, test } from "bun:test";
import { join } from "node:path";
import type { McpClientHandle } from "../src/types";
import { connect } from "../src/client";

const fixturePath = join(import.meta.dir, "fixtures", "test-server.ts");

const openHandles: McpClientHandle[] = [];
afterAll(async () => {
	for (const handle of openHandles.splice(0)) {
		try {
			await handle.close();
		} catch {
			// best-effort cleanup
		}
	}
});

async function connectFixture(): Promise<McpClientHandle> {
	const handle = await connect({
		name: "fixture",
		transport: "stdio",
		command: process.execPath,
		args: [fixturePath],
	});
	openHandles.push(handle);
	return handle;
}

async function waitFor(
	predicate: () => boolean,
	timeoutMs = 5000,
): Promise<void> {
	const start = Date.now();
	while (!predicate()) {
		if (Date.now() - start > timeoutMs) throw new Error("waitFor timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
}

test("connects to the fixture server over real stdio MCP protocol", async () => {
	const handle = await connectFixture();
	expect(handle.status).toBe("connected");
});

test("tools/list returns the fixture's echo and add tools", async () => {
	const handle = await connectFixture();
	const tools = await handle.listTools();
	const names = tools.map((t) => t.name).sort();
	expect(names).toEqual(["add", "echo"]);
});

test("calling add(2, 3) via the bridge protocol returns 5", async () => {
	const handle = await connectFixture();
	const result = await handle.callTool("add", { a: 2, b: 3 });
	expect(result.ok).toBe(true);
	const content = result.value as Array<{ type: string; text?: string }>;
	expect(content.some((c) => c.text === "5")).toBe(true);
});

test("calling echo returns the same text", async () => {
	const handle = await connectFixture();
	const result = await handle.callTool("echo", { text: "hello mcp" });
	expect(result.ok).toBe(true);
	const content = result.value as Array<{ type: string; text?: string }>;
	expect(content.some((c) => c.text === "hello mcp")).toBe(true);
});

test("killing the server process degrades health-check to disconnected", async () => {
	const handle = await connectFixture();
	expect(handle.status).toBe("connected");
	expect(handle.pid).not.toBeNull();

	process.kill(handle.pid as number, "SIGKILL");

	await waitFor(
		() => handle.status === "disconnected" || handle.status === "failed",
	);
	const health = await handle.healthCheck();
	expect(health === "disconnected" || health === "failed").toBe(true);

	await handle.close();
});
