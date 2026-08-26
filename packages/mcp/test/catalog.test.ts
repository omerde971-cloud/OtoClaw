import { expect, test } from "bun:test";
import { join } from "node:path";
import { McpRegistry } from "../src/registry";

const fixturePath = join(import.meta.dir, "fixtures", "test-server.ts");

// Overrides point the "blender" and "unity" catalog entries at this package's deterministic
// stdio test fixture instead of the real (unavailable-in-CI) Blender/Unity MCP servers.
const fixtureOverride = { command: process.execPath, args: [fixturePath] };

test("connectKnown('blender', override) connects to the fixture and lists echo/add tools", async () => {
	const registry = new McpRegistry();
	const attempt = await registry.connectKnown("blender", fixtureOverride);
	expect(attempt.ok).toBe(true);
	expect(attempt.name).toBe("blender");

	const handle = registry.get("blender");
	expect(handle).toBeDefined();
	const tools = (await handle?.listTools()) ?? [];
	expect(tools.map((t) => t.name).sort()).toEqual(["add", "echo"]);

	await registry.disconnectOne("blender");
});

test("connectKnown('unity', override) connects to the fixture and lists echo/add tools", async () => {
	const registry = new McpRegistry();
	const attempt = await registry.connectKnown("unity", fixtureOverride);
	expect(attempt.ok).toBe(true);
	expect(attempt.name).toBe("unity");

	const handle = registry.get("unity");
	expect(handle).toBeDefined();
	const tools = (await handle?.listTools()) ?? [];
	expect(tools.map((t) => t.name).sort()).toEqual(["add", "echo"]);

	await registry.disconnectOne("unity");
});

test("connectKnown returns ok:false for an unknown catalog name instead of throwing", async () => {
	const registry = new McpRegistry();
	const attempt = await registry.connectKnown("does-not-exist");
	expect(attempt.ok).toBe(false);
	expect(attempt.status).toBe("failed");
	expect(attempt.error).toBeDefined();
});
