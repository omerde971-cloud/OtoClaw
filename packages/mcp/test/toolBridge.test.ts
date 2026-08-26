import { afterAll, expect, test } from "bun:test";
import { join } from "node:path";
import { ToolRegistry } from "@otoclaw/tools";
import { connect } from "../src/client";
import { bridgeMcpTools } from "../src/toolBridge";
import type { McpClientHandle } from "../src/types";

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

test("bridged mcp tools register into a ToolRegistry and behave like built-in tools", async () => {
	const handle = await connectFixture();
	const tools = await bridgeMcpTools(handle);
	expect(tools.map((t) => t.name).sort()).toEqual([
		"mcp.fixture.add",
		"mcp.fixture.echo",
	]);
	for (const tool of tools) expect(tool.permissionKey).toBe("mcp");

	const registry = new ToolRegistry();
	for (const tool of tools) registry.register(tool);

	const addTool = registry.get("mcp.fixture.add");
	expect(addTool).toBeDefined();

	const result = await addTool?.run(
		{ a: 4, b: 5 },
		{ cwd: process.cwd(), sessionId: "test-session" },
	);
	expect(result?.ok).toBe(true);
	const content = result?.value as Array<{ type: string; text?: string }>;
	expect(content.some((c) => c.text === "9")).toBe(true);
});

test("ToolRegistry.toJsonSchema exposes the bridged tool's MCP input schema", async () => {
	const handle = await connectFixture();
	const tools = await bridgeMcpTools(handle);
	const registry = new ToolRegistry();
	for (const tool of tools) registry.register(tool);

	const exported = registry
		.toJsonSchema()
		.find((t) => t.name === "mcp.fixture.echo");
	expect(exported).toBeDefined();
	expect(exported?.parameters).toBeDefined();
});
