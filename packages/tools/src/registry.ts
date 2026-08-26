import type { JsonSchema, Tool } from "./types";

export interface ToolSchemaExport {
	name: string;
	description: string;
	parameters: JsonSchema;
}

export class ToolRegistry {
	private readonly tools = new Map<string, Tool>();

	register(tool: Tool): void {
		this.tools.set(tool.name, tool);
	}

	get(name: string): Tool | undefined {
		return this.tools.get(name);
	}

	list(): Tool[] {
		return [...this.tools.values()];
	}

	/** JSON Schema export shaped for provider function-calling. */
	toJsonSchema(): ToolSchemaExport[] {
		return this.list().map((tool) => ({
			name: tool.name,
			description: tool.description,
			parameters: tool.schema,
		}));
	}
}

export function createDefaultRegistry(tools: Tool[]): ToolRegistry {
	const registry = new ToolRegistry();
	for (const tool of tools) registry.register(tool);
	return registry;
}

export interface McpToolDescriptor {
	name: string;
	description?: string;
	inputSchema: JsonSchema;
}

/**
 * Structural (duck-typed) shape a connected MCP server handle must satisfy to be registered
 * here. Defined locally rather than importing `@otoclaw/mcp` to avoid a circular workspace
 * dependency (the mcp package depends on this one for the `Tool` type).
 */
export interface McpToolSource {
	name: string;
	listTools(): Promise<McpToolDescriptor[]>;
	callTool(
		name: string,
		args: Record<string, unknown>,
	): Promise<{ ok: boolean; value?: unknown; error?: string }>;
}

/** Fetches each source's live tool list and registers them dynamically as `mcp.<server>.<tool>`. */
export async function registerMcpTools(
	registry: ToolRegistry,
	sources: McpToolSource[],
): Promise<void> {
	for (const source of sources) {
		const descriptors = await source.listTools();
		for (const descriptor of descriptors) {
			registry.register({
				name: `mcp.${source.name}.${descriptor.name}`,
				description:
					descriptor.description ??
					`MCP tool "${descriptor.name}" from server "${source.name}"`,
				permissionKey: "mcp",
				schema: descriptor.inputSchema,
				async run(args) {
					return source.callTool(
						descriptor.name,
						args as Record<string, unknown>,
					);
				},
			});
		}
	}
}
