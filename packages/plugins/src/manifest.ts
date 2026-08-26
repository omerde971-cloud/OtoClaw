export type PluginKind = "skill" | "mcp-server";

/** Common subset of SkillManifest and a configured MCP server, shared across both kinds. */
export interface PluginManifest {
	kind: PluginKind;
	name: string;
	description: string;
	version: string;
	source: string;
}
