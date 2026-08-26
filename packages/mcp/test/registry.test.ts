import { expect, test } from "bun:test";
import { join } from "node:path";
import { McpRegistry } from "../src/registry";

const fixturePath = join(import.meta.dir, "fixtures", "test-server.ts");

function fixtureConfig(name: string) {
	return {
		name,
		transport: "stdio" as const,
		command: process.execPath,
		args: [fixturePath],
	};
}

test("disconnectOne closes the named server and removes it from the registry", async () => {
	const registry = new McpRegistry();
	const attempt = await registry.connectOne(fixtureConfig("fixture-disconnect"));
	expect(attempt.ok).toBe(true);
	expect(registry.get("fixture-disconnect")).toBeDefined();

	await registry.disconnectOne("fixture-disconnect");

	expect(registry.get("fixture-disconnect")).toBeUndefined();
	expect(registry.list()).toEqual([]);
});

test("disconnectOne is a no-op for an unknown server name", async () => {
	const registry = new McpRegistry();
	await expect(registry.disconnectOne("does-not-exist")).resolves.toBeUndefined();
});
