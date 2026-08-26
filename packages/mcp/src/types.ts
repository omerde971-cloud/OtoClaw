import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { McpServerConfig } from "@otoclaw/shared";

export type { McpServerConfig } from "@otoclaw/shared";

export type McpConnectionStatus =
	| "connecting"
	| "connected"
	| "disconnected"
	| "failed";

export interface McpToolDescriptor {
	name: string;
	description?: string;
	inputSchema: Record<string, unknown>;
}

export interface McpClientHandle {
	readonly config: McpServerConfig;
	status: McpConnectionStatus;
	readonly client: Client;
	/** The spawned child process id for a stdio server, or null for http / before start. */
	readonly pid: number | null;
	listTools(): Promise<McpToolDescriptor[]>;
	callTool(
		name: string,
		args: Record<string, unknown>,
	): Promise<{ ok: boolean; value?: unknown; error?: string }>;
	/** Re-checks the live transport (ping when connected) rather than trusting the cached status. */
	healthCheck(): Promise<McpConnectionStatus>;
	close(): Promise<void>;
}
