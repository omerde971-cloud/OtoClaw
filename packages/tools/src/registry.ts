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
