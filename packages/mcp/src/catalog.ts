import type { McpServerConfig } from "@otoclaw/shared";

/**
 * Known third-party MCP servers, keyed by a short catalog name. `command`/`args` here are
 * placeholders for the most common local setup of each server — they assume the tool is
 * already installed and reachable the way its own docs describe. The user's actual environment
 * (installed location, package manager, OS) will often differ, so these entries exist to be
 * overridden via `resolveKnownServerConfig`'s `overrides` argument rather than trusted as-is.
 */
export const KNOWN_MCP_SERVERS: Record<string, Omit<McpServerConfig, "name">> = {
	// ahujasid/blender-mcp: a Blender addon + stdio MCP server bridging to Blender's own
	// socket server on port 9876. `uvx blender-mcp` is the command documented by that project;
	// requires the Blender-side addon to be installed and running separately.
	blender: {
		transport: "stdio",
		command: "uvx",
		args: ["blender-mcp"],
	},
	// "MCP for Unity" (Unity Editor MCP bridge). The exact published package name/repo/version
	// varies by source and changes over time, so this entry is a best-effort placeholder only —
	// the user must override `command`/`args` to match how they installed it in their own
	// environment (e.g. a local server script path from the Unity package's `~Server` folder).
	unity: {
		transport: "stdio",
		command: "uvx",
		args: ["mcp-for-unity"],
	},
};

/**
 * Resolves a catalog entry into a full `McpServerConfig`, applying `overrides` on top of the
 * placeholder defaults. `overrides.transport` is rejected when it isn't "stdio" — the mcp
 * package's client only supports stdio transport today.
 */
export function resolveKnownServerConfig(
	name: string,
	overrides?: Partial<Omit<McpServerConfig, "name">>,
): McpServerConfig {
	const base = KNOWN_MCP_SERVERS[name];
	if (!base) {
		throw new Error(`mcp catalog: unknown server "${name}"`);
	}
	const merged = { ...base, ...overrides };
	if (merged.transport !== "stdio") {
		throw new Error(
			`mcp catalog: server "${name}" requested transport "${merged.transport}", but only "stdio" is supported`,
		);
	}
	return { name, ...merged };
}
