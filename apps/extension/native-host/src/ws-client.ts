import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { DaemonRuntimeInfoSchema, type DaemonRuntimeInfo } from "@otoclaw/shared";

export function daemonJsonPath(): string {
	return join(homedir(), ".otoclaw", "daemon.json");
}

export async function readDaemonRuntimeInfo(path: string = daemonJsonPath()): Promise<DaemonRuntimeInfo> {
	const raw = await readFile(path, "utf8");
	return DaemonRuntimeInfoSchema.parse(JSON.parse(raw));
}

/**
 * Connects to the daemon's WS server and registers this process as the browser bridge
 * (see packages/daemon/src/server.ts's `bridge.register` handling). Reconnection and real
 * request forwarding are wired up in Phase 4b/4c on top of this connection.
 */
export async function connectToDaemon(runtimeInfo: DaemonRuntimeInfo): Promise<WebSocket> {
	const ws = new WebSocket(`ws://127.0.0.1:${runtimeInfo.port}/ws?token=${runtimeInfo.token}`);
	await new Promise<void>((resolve, reject) => {
		ws.onopen = () => resolve();
		ws.onerror = () => reject(new Error("failed to connect to daemon"));
	});
	ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "bridge.register", params: { role: "bridge" } }));
	return ws;
}
