import { expect, test } from "bun:test";
import type { McpClientHandle, McpRegistry } from "@otoclaw/mcp";
import { SkillRegistry } from "@otoclaw/skills";
import { listPlugins } from "../src/unifiedRegistry";

function fakeSkillRegistry(): SkillRegistry {
	const registry = new SkillRegistry();
	registry.register({
		manifest: {
			name: "pdf-fill",
			description: "Fills PDF forms",
			triggers: ["pdf", "form"],
			version: "1.0.0",
			source: "local:/skills/pdf-fill",
		},
		instructions: "Fill the PDF form fields from the given data.",
	});
	registry.register({
		manifest: {
			name: "release-notes",
			description: "Drafts release notes from commits",
			triggers: ["release", "changelog"],
			version: "2.1.0",
			source: "github:acme/release-notes-skill",
		},
		instructions: "Summarize commits since the last tag into release notes.",
	});
	return registry;
}

function fakeHandle(overrides: Partial<McpClientHandle["config"]>): McpClientHandle {
	return {
		config: { name: "fake", transport: "stdio", args: [], ...overrides },
		status: "connected",
		client: {} as McpClientHandle["client"],
		pid: 1234,
		listTools: async () => [],
		callTool: async () => ({ ok: true }),
		healthCheck: async () => "connected",
		close: async () => {},
	} as McpClientHandle;
}

function fakeMcpRegistry(handles: McpClientHandle[]): McpRegistry {
	return { list: () => handles } as unknown as McpRegistry;
}

test("listPlugins merges skills and mcp servers into normalized PluginManifest[]", () => {
	const skillRegistry = fakeSkillRegistry();
	const mcpRegistry = fakeMcpRegistry([
		fakeHandle({ name: "filesystem", transport: "stdio", command: "npx", args: ["-y", "fs-mcp"] }),
		fakeHandle({ name: "search", transport: "http", url: "https://example.com/mcp" }),
	]);

	const plugins = listPlugins(skillRegistry, mcpRegistry);

	expect(plugins).toHaveLength(4);

	expect(plugins).toContainEqual({
		kind: "skill",
		name: "pdf-fill",
		description: "Fills PDF forms",
		version: "1.0.0",
		source: "local:/skills/pdf-fill",
	});
	expect(plugins).toContainEqual({
		kind: "skill",
		name: "release-notes",
		description: "Drafts release notes from commits",
		version: "2.1.0",
		source: "github:acme/release-notes-skill",
	});
	expect(plugins).toContainEqual({
		kind: "mcp-server",
		name: "filesystem",
		description: "",
		version: "",
		source: "npx",
	});
	expect(plugins).toContainEqual({
		kind: "mcp-server",
		name: "search",
		description: "",
		version: "",
		source: "https://example.com/mcp",
	});
});

test("listPlugins returns an empty array when both registries are empty", () => {
	expect(listPlugins(new SkillRegistry(), fakeMcpRegistry([]))).toEqual([]);
});
