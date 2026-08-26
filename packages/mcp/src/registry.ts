import { resolveKnownServerConfig } from "./catalog";
import { connect } from "./client";
import type { McpClientHandle, McpServerConfig } from "./types";

export interface McpConnectAttempt {
	name: string;
	ok: boolean;
	status: string;
	error?: string;
}

/** Lifecycle manager for the set of MCP servers configured in `config.mcpServers`. */
export class McpRegistry {
	private readonly handles = new Map<string, McpClientHandle>();

	/** Connects every configured server; a failed connection is reported, never thrown. */
	async connectAll(configs: McpServerConfig[]): Promise<McpConnectAttempt[]> {
		const attempts: McpConnectAttempt[] = [];
		for (const config of configs) {
			attempts.push(await this.connectOne(config));
		}
		return attempts;
	}

	async connectOne(config: McpServerConfig): Promise<McpConnectAttempt> {
		try {
			const handle = await connect(config);
			this.handles.set(config.name, handle);
			return { name: config.name, ok: true, status: handle.status };
		} catch (err) {
			return {
				name: config.name,
				ok: false,
				status: "failed",
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}

	/** Connects a catalog entry (see catalog.ts) by name, applying `overrides` on top of it. */
	async connectKnown(
		name: string,
		overrides?: Partial<Omit<McpServerConfig, "name">>,
	): Promise<McpConnectAttempt> {
		try {
			const config = resolveKnownServerConfig(name, overrides);
			return await this.connectOne(config);
		} catch (err) {
			return {
				name,
				ok: false,
				status: "failed",
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}

	async disconnectAll(): Promise<void> {
		for (const handle of this.handles.values()) {
			await handle.close();
		}
		this.handles.clear();
	}

	async disconnectOne(name: string): Promise<void> {
		const handle = this.handles.get(name);
		if (!handle) return;
		await handle.close();
		this.handles.delete(name);
	}

	get(name: string): McpClientHandle | undefined {
		return this.handles.get(name);
	}

	list(): McpClientHandle[] {
		return [...this.handles.values()];
	}
}
