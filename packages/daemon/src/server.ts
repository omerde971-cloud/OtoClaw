import { chmodSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Database } from "bun:sqlite";
import {
	DaemonRuntimeInfoSchema,
	type EchoNotification,
	type JsonRpcRequest,
	type JsonRpcResponse,
} from "@otoclaw/shared";
import { createSession, otoclawDir } from "./store";

interface WsData {
	authenticated: true;
}

export interface DaemonServer {
	server: ReturnType<typeof Bun.serve<WsData>>;
	port: number;
	token: string;
	stop: () => void;
}

export function startServer(db: Database): DaemonServer {
	const token = crypto.randomUUID();

	const server = Bun.serve<WsData>({
		hostname: "127.0.0.1",
		port: 0,
		fetch(req, srv) {
			const url = new URL(req.url);
			if (url.pathname === "/ws") {
				if (url.searchParams.get("token") !== token) {
					return new Response("Unauthorized", { status: 401 });
				}
				if (srv.upgrade(req, { data: { authenticated: true } })) {
					return undefined;
				}
				return new Response("Upgrade failed", { status: 400 });
			}
			return new Response("Not found", { status: 404 });
		},
		websocket: {
			message(ws, raw) {
				let request: JsonRpcRequest;
				try {
					request = JSON.parse(raw.toString());
				} catch {
					ws.send(
						JSON.stringify({
							jsonrpc: "2.0",
							id: null,
							error: { code: -32700, message: "Parse error" },
						}),
					);
					return;
				}

				try {
					handleRequest(db, ws, request);
				} catch (err) {
					const response: JsonRpcResponse = {
						jsonrpc: "2.0",
						id: request.id,
						error: {
							code: -32603,
							message: err instanceof Error ? err.message : "Internal error",
						},
					};
					ws.send(JSON.stringify(response));
				}
			},
		},
	});

	const runtimeInfo = DaemonRuntimeInfoSchema.parse({
		port: server.port,
		token,
		pid: process.pid,
		startedAt: new Date().toISOString(),
	});

	const daemonJsonPath = join(otoclawDir(), "daemon.json");
	writeFileSync(daemonJsonPath, JSON.stringify(runtimeInfo, null, 2));
	try {
		chmodSync(daemonJsonPath, 0o600);
	} catch {
		// no-op on platforms (e.g. Windows) that don't support POSIX permissions
	}

	return {
		server,
		port: server.port ?? 0,
		token,
		stop: () => {
			server.stop(true);
			const daemonJson = join(otoclawDir(), "daemon.json");
			if (existsSync(daemonJson)) {
				rmSync(daemonJson);
			}
		},
	};
}

function handleRequest(
	db: Database,
	ws: { send: (data: string) => void },
	request: JsonRpcRequest,
): void {
	switch (request.method) {
		case "session.create": {
			const params = request.params as { cwd: string; mode: "manual" | "auto" };
			const session = createSession(db, params.cwd, params.mode);
			const response: JsonRpcResponse = {
				jsonrpc: "2.0",
				id: request.id,
				result: { sessionId: session.id },
			};
			ws.send(JSON.stringify(response));
			return;
		}
		case "echo.send": {
			const params = request.params as { sessionId: string; message: string };
			const response: JsonRpcResponse = {
				jsonrpc: "2.0",
				id: request.id,
				result: { ok: true },
			};
			ws.send(JSON.stringify(response));

			const notification: EchoNotification = {
				jsonrpc: "2.0",
				method: "echo",
				params: {
					sessionId: params.sessionId,
					message: params.message,
					ts: new Date().toISOString(),
				},
			};
			ws.send(JSON.stringify(notification));
			return;
		}
		default: {
			const response: JsonRpcResponse = {
				jsonrpc: "2.0",
				id: request.id,
				error: { code: -32601, message: "Method not found" },
			};
			ws.send(JSON.stringify(response));
		}
	}
}
