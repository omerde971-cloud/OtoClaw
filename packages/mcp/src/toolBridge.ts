import type { JsonSchema, Tool, ToolResult } from "@otoclaw/tools";
import type { McpClientHandle, McpToolDescriptor } from "./types";

function toTool(handle: McpClientHandle, descriptor: McpToolDescriptor): Tool {
	return {
		name: `mcp.${handle.config.name}.${descriptor.name}`,
		description:
			descriptor.description ??
			`MCP tool "${descriptor.name}" from server "${handle.config.name}"`,
		permissionKey: "mcp",
		schema: descriptor.inputSchema as JsonSchema,
		async run(args: Record<string, unknown>): Promise<ToolResult> {
			return handle.callTool(descriptor.name, args);
		},
	};
}

/** Adapts every tool a connected MCP server exposes into the `@otoclaw/tools` `Tool<>` shape. */
export async function bridgeMcpTools(handle: McpClientHandle): Promise<Tool[]> {
	const descriptors = await handle.listTools();
	return descriptors.map((descriptor) => toTool(handle, descriptor));
}
