import type { McpRegistry } from "@otoclaw/mcp";
import type { SkillRegistry } from "@otoclaw/skills";
import type { PluginManifest } from "./manifest";

/**
 * Normalizes and merges skills (instruction-level) and connected MCP servers
 * (tool-level) into one flat plugin list. Pure read — no new state/mechanism.
 */
export function listPlugins(
	skillRegistry: SkillRegistry,
	mcpRegistry: McpRegistry,
): PluginManifest[] {
	const skillPlugins: PluginManifest[] = skillRegistry.list().map((skill) => ({
		kind: "skill",
		name: skill.manifest.name,
		description: skill.manifest.description,
		version: skill.manifest.version,
		source: skill.manifest.source,
	}));

	const mcpPlugins: PluginManifest[] = mcpRegistry.list().map((handle) => ({
		kind: "mcp-server",
		name: handle.config.name,
		// McpServerConfig carries no description/version — an MCP server is a tool
		// connection, not a versioned manifest like a skill.
		description: "",
		version: "",
		source: handle.config.url ?? handle.config.command ?? "",
	}));

	return [...skillPlugins, ...mcpPlugins];
}
