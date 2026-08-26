import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type {
	McpClientHandle,
	McpConnectionStatus,
	McpServerConfig,
	McpToolDescriptor,
} from "./types";

const MAX_RESTART_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1000;
const CLIENT_INFO = { name: "otoclaw", version: "0.0.0" };

/** Like `setTimeout`, but `unref()`'d so a pending backoff never keeps the process alive. */
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		const timer = setTimeout(resolve, ms);
		if (typeof timer === "object" && timer !== null && "unref" in timer) {
			(timer as { unref: () => void }).unref();
		}
	});
}

function createTransport(config: McpServerConfig): StdioClientTransport {
	if (config.transport !== "stdio") {
		throw new Error(
			`mcp server "${config.name}": transport "${config.transport}" is not supported yet (Phase 2 covers stdio only)`,
		);
	}
	if (!config.command) {
		throw new Error(
			`mcp server "${config.name}": stdio transport requires "command"`,
		);
	}
	return new StdioClientTransport({
		command: config.command,
		args: config.args ?? [],
	});
}

class ManagedMcpClientHandle implements McpClientHandle {
	status: McpConnectionStatus = "connecting";
	client: Client;
	private transport: Transport | undefined;
	private closed = false;
	private restartAttempts = 0;

	constructor(readonly config: McpServerConfig) {
		this.client = new Client(CLIENT_INFO);
	}

	get pid(): number | null {
		return this.transport instanceof StdioClientTransport
			? this.transport.pid
			: null;
	}

	async connect(): Promise<void> {
		const transport = createTransport(this.config);
		transport.onclose = () => this.handleUnexpectedClose();
		this.transport = transport;
		await this.client.connect(transport);
		this.status = "connected";
		this.restartAttempts = 0;
	}

	private handleUnexpectedClose(): void {
		if (this.closed) return;
		this.status = "disconnected";
		void this.scheduleRestart();
	}

	private async scheduleRestart(): Promise<void> {
		if (this.closed) return;
		if (this.restartAttempts >= MAX_RESTART_ATTEMPTS) {
			this.status = "failed";
			return;
		}
		const delayMs = BASE_BACKOFF_MS * 2 ** this.restartAttempts;
		this.restartAttempts += 1;
		await delay(delayMs);
		if (this.closed) return;
		try {
			this.client = new Client(CLIENT_INFO);
			await this.connect();
		} catch {
			await this.scheduleRestart();
		}
	}

	async listTools(): Promise<McpToolDescriptor[]> {
		const result = await this.client.listTools();
		return result.tools.map((tool) => ({
			name: tool.name,
			description: tool.description,
			inputSchema: (tool.inputSchema ?? {
				type: "object",
				properties: {},
			}) as Record<string, unknown>,
		}));
	}

	async callTool(
		name: string,
		args: Record<string, unknown>,
	): Promise<{ ok: boolean; value?: unknown; error?: string }> {
		try {
			const result = await this.client.callTool({ name, arguments: args });
			if (result.isError) {
				return {
					ok: false,
					error:
						extractText(result.content) ??
						`mcp tool "${name}" returned an error`,
				};
			}
			return { ok: true, value: result.structuredContent ?? result.content };
		} catch (err) {
			return {
				ok: false,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}

	async healthCheck(): Promise<McpConnectionStatus> {
		if (this.status !== "connected") return this.status;
		try {
			await this.client.ping();
			return this.status;
		} catch {
			this.status = "disconnected";
			return this.status;
		}
	}

	async close(): Promise<void> {
		this.closed = true;
		this.status = "disconnected";
		await this.client.close();
	}
}

function extractText(content: unknown): string | undefined {
	if (!Array.isArray(content)) return undefined;
	const first = content.find(
		(entry) => entry && typeof entry === "object" && "text" in entry,
	) as { text?: string } | undefined;
	return first?.text;
}

/** Connects to an MCP server per `config`, applying restart-on-crash for stdio servers. */
export async function connect(
	config: McpServerConfig,
): Promise<McpClientHandle> {
	const handle = new ManagedMcpClientHandle(config);
	await handle.connect();
	return handle;
}
