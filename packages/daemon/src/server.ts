import { randomUUID } from "node:crypto";
import { chmodSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Database } from "bun:sqlite";
import {
	type AgentEvents,
	NodeAgentEvents,
	runTask,
} from "@otoclaw/agent";
import { McpRegistry } from "@otoclaw/mcp";
import { PermissionEngine, type SessionOverrides } from "@otoclaw/permission";
import {
	KNOWN_PROVIDER_IDS,
	NapiKeyStore,
	type KeyStore,
	type ResolvedProvider,
	resolve as resolveProviderSpec,
} from "@otoclaw/providers";
import {
	ConfigSchema,
	DaemonRuntimeInfoSchema,
	type ConfigSetParams,
	type EchoNotification,
	type ErrorEventPayload,
	type JsonRpcNotification,
	type JsonRpcRequest,
	type JsonRpcResponse,
	type JudgeVerdictPayload,
	type MascotStatePayload,
	type McpConnectParams,
	type McpListResult,
	type McpServerInfo,
	type MessageSendParams,
	type ModeSetParams,
	type ModelInfo,
	type ModelSetParams,
	type PermissionRequestPayload,
	type PermissionRespondParams,
	type ProviderAddKeyParams,
	type QuestionAskPayload,
	type QuestionRespondParams,
	type RunCancelParams,
} from "@otoclaw/shared";
import { defaultToolRegistry, registerMcpTools } from "@otoclaw/tools";
import { DaemonPermissionChannel, DaemonQuestionChannel, type PendingPermission, type PendingQuestion } from "./channels";
import { loadConfig, saveConfig } from "./config";
import { stageMascotState, toolMascotState } from "./mascot";
import { createSession, getSession, otoclawDir, saveVerdict } from "./store";

interface WsData {
	authenticated: true;
}

type WsLike = { send: (data: string) => void };

interface SessionState {
	sessionId: string;
	cwd: string;
	mode: "manual" | "auto";
	model?: string;
	sessionOverrides: SessionOverrides;
}

export interface StartServerOptions {
	/** Test-mode injection point: override how a "provider/model" spec resolves to a real Provider. */
	resolveProvider?: (spec: string, keyStore: KeyStore) => Promise<ResolvedProvider>;
	keyStore?: KeyStore;
}

export interface DaemonServer {
	server: ReturnType<typeof Bun.serve<WsData>>;
	port: number;
	token: string;
	stop: () => void;
}

export function startServer(db: Database, options: StartServerOptions = {}): DaemonServer {
	const token = crypto.randomUUID();
	const keyStore = options.keyStore ?? new NapiKeyStore();
	const resolveProvider = options.resolveProvider ?? resolveProviderSpec;

	const clients = new Set<WsLike>();
	const sessionStates = new Map<string, SessionState>();
	const pendingPermissions = new Map<string, PendingPermission>();
	const pendingQuestions = new Map<string, PendingQuestion>();
	const runAbortControllers = new Map<string, AbortController>();
	const lastCost = new Map<string, { tokensIn: number; tokensOut: number; usd: number }>();
	const mcpRegistry = new McpRegistry();

	function broadcastMcpStatus(name: string, status: string, error?: string): void {
		broadcast({ jsonrpc: "2.0", method: "mcp.status", params: { name, status, error } });
	}

	/**
	 * Best-effort: a configured MCP server that fails to connect (missing binary, crash, etc.)
	 * is logged and reported via mcp.status, never allowed to bring the daemon down.
	 */
	async function connectConfiguredMcpServers(): Promise<void> {
		const config = loadConfig();
		for (const serverConfig of config.mcpServers) {
			const attempt = await mcpRegistry.connectOne(serverConfig);
			broadcastMcpStatus(attempt.name, attempt.status, attempt.error);
			if (!attempt.ok) {
				console.error(`[mcp] failed to connect "${attempt.name}": ${attempt.error}`);
				continue;
			}
			const handle = mcpRegistry.get(attempt.name);
			if (!handle) continue;
			try {
				await registerMcpTools(defaultToolRegistry, [
					{
						name: handle.config.name,
						listTools: () => handle.listTools(),
						callTool: (toolName, args) => handle.callTool(toolName, args),
					},
				]);
			} catch (err) {
				console.error(`[mcp] failed to register tools for "${attempt.name}": ${err instanceof Error ? err.message : String(err)}`);
			}
		}
	}

	function broadcast<TMethod extends string, TParams>(notification: JsonRpcNotification<TMethod, TParams>): void {
		const raw = JSON.stringify(notification);
		for (const client of clients) client.send(raw);
	}

	function sendMascot(sessionId: string, state: string): void {
		const payload: MascotStatePayload = { sessionId, state, since: new Date().toISOString() };
		broadcast({ jsonrpc: "2.0", method: "mascot.state", params: payload });
	}

	function getOrCreateState(sessionId: string): SessionState {
		const existing = sessionStates.get(sessionId);
		if (existing) return existing;
		const session = getSession(db, sessionId);
		if (!session) throw new Error(`unknown session "${sessionId}"`);
		const state: SessionState = { sessionId, cwd: session.cwd, mode: session.mode, sessionOverrides: {} };
		sessionStates.set(sessionId, state);
		return state;
	}

	function wireEvents(sessionId: string): AgentEvents {
		const events = new NodeAgentEvents();
		events.on("stream.delta", ({ text }) => {
			broadcast({ jsonrpc: "2.0", method: "stream.delta", params: { sessionId, text } });
		});
		events.on("pipeline.stage", ({ stage, detail }) => {
			broadcast({ jsonrpc: "2.0", method: "pipeline.stage", params: { sessionId, stage, detail } });
			const mascot = stageMascotState(stage);
			if (mascot) sendMascot(sessionId, mascot);
		});
		events.on("tool.start", ({ toolCallId, name, args }) => {
			broadcast({ jsonrpc: "2.0", method: "tool.start", params: { sessionId, toolCallId, name, args } });
			sendMascot(sessionId, toolMascotState(name));
		});
		events.on("tool.end", ({ toolCallId, name, result }) => {
			broadcast({ jsonrpc: "2.0", method: "tool.end", params: { sessionId, toolCallId, name, result } });
		});
		events.on("permission.request", () => {
			sendMascot(sessionId, "waiting");
		});
		events.on("subagent.spawn", ({ agentId, role, brief, status }) => {
			broadcast({ jsonrpc: "2.0", method: "subagent.spawn", params: { sessionId, agentId, role, brief, status } });
		});
		events.on("subagent.update", ({ agentId, role, brief, status }) => {
			broadcast({ jsonrpc: "2.0", method: "subagent.update", params: { sessionId, agentId, role, brief, status } });
		});
		events.on("subagent.done", ({ agentId, role, brief, status, result }) => {
			broadcast({ jsonrpc: "2.0", method: "subagent.done", params: { sessionId, agentId, role, brief, status, result } });
		});
		events.on("judge.verdict", (verdict) => {
			saveVerdict(db, sessionId, verdict);
			const params: JudgeVerdictPayload = {
				sessionId,
				target: verdict.targetId,
				score: verdict.score,
				label: verdict.label,
				notes: verdict.notes,
			};
			broadcast({ jsonrpc: "2.0", method: "judge.verdict", params });
		});
		events.on("error", (payload) => {
			const params: ErrorEventPayload = { sessionId, ...payload };
			broadcast({ jsonrpc: "2.0", method: "error", params });
		});
		return events;
	}

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
			open(ws) {
				clients.add(ws);
			},
			close(ws) {
				clients.delete(ws);
			},
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
					handleRequest(request, ws);
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

	function reply(ws: WsLike, id: number | string, result: unknown): void {
		const response: JsonRpcResponse = { jsonrpc: "2.0", id, result };
		ws.send(JSON.stringify(response));
	}

	function replyError(ws: WsLike, id: number | string, message: string, code = -32603): void {
		const response: JsonRpcResponse = { jsonrpc: "2.0", id, error: { code, message } };
		ws.send(JSON.stringify(response));
	}

	async function runMessage(sessionId: string, text: string): Promise<void> {
		const state = getOrCreateState(sessionId);
		const model = state.model ?? loadConfig().model;
		if (!model) {
			broadcast({
				jsonrpc: "2.0",
				method: "error",
				params: { sessionId, code: "no_model", message: "no model set for session; call model.set first", recoverable: true } satisfies ErrorEventPayload,
			});
			return;
		}

		const abortController = new AbortController();
		runAbortControllers.set(sessionId, abortController);
		const events = wireEvents(sessionId);

		try {
			const { provider, model: resolvedModel } = await resolveProvider(model, keyStore);
			const permissionChannel = new DaemonPermissionChannel(sessionId, pendingPermissions, state.sessionOverrides, (payload) => {
				broadcast({ jsonrpc: "2.0", method: "permission.request", params: payload satisfies PermissionRequestPayload });
			});
			const questionChannel = new DaemonQuestionChannel(sessionId, pendingQuestions, (payload) => {
				broadcast({ jsonrpc: "2.0", method: "question.ask", params: payload satisfies QuestionAskPayload });
				sendMascot(sessionId, "waiting");
			});

			await runTask(
				{
					session: { id: sessionId, cwd: state.cwd, mode: state.mode, createdAt: new Date().toISOString() },
					provider,
					model: resolvedModel,
					toolRegistry: defaultToolRegistry,
					toolContext: { cwd: state.cwd, sessionId },
					permissionEngine: new PermissionEngine(),
					mode: state.mode,
					sessionOverrides: state.sessionOverrides,
					projectPolicy: null,
					globalConfig: loadConfig(),
					questionChannel,
					permissionChannel,
					events,
					signal: abortController.signal,
				},
				{ userText: text },
			);

			lastCost.set(sessionId, { tokensIn: 0, tokensOut: 0, usd: 0 });
			broadcast({
				jsonrpc: "2.0",
				method: "cost.update",
				params: { sessionId, ...lastCost.get(sessionId) },
			});
			sendMascot(sessionId, "done");
		} catch (err) {
			broadcast({
				jsonrpc: "2.0",
				method: "error",
				params: {
					sessionId,
					code: "run_failed",
					message: err instanceof Error ? err.message : "run failed",
					recoverable: true,
				} satisfies ErrorEventPayload,
			});
		} finally {
			runAbortControllers.delete(sessionId);
		}
	}

	function handleRequest(request: JsonRpcRequest, ws: WsLike): void {
		switch (request.method) {
			case "session.create": {
				const params = request.params as { cwd: string; mode: "manual" | "auto" };
				const session = createSession(db, params.cwd, params.mode);
				sessionStates.set(session.id, {
					sessionId: session.id,
					cwd: session.cwd,
					mode: session.mode,
					sessionOverrides: {},
				});
				reply(ws, request.id, { sessionId: session.id });
				return;
			}
			case "echo.send": {
				const params = request.params as { sessionId: string; message: string };
				reply(ws, request.id, { ok: true });
				const notification: EchoNotification = {
					jsonrpc: "2.0",
					method: "echo",
					params: { sessionId: params.sessionId, message: params.message, ts: new Date().toISOString() },
				};
				ws.send(JSON.stringify(notification));
				return;
			}
			case "message.send": {
				const params = request.params as MessageSendParams;
				const messageId = randomUUID();
				reply(ws, request.id, { messageId });
				void runMessage(params.sessionId, params.text);
				return;
			}
			case "run.cancel": {
				const params = request.params as RunCancelParams;
				runAbortControllers.get(params.sessionId)?.abort();
				reply(ws, request.id, { ok: true });
				return;
			}
			case "mode.set": {
				const params = request.params as ModeSetParams;
				const state = getOrCreateState(params.sessionId);
				state.mode = params.mode;
				reply(ws, request.id, { ok: true });
				return;
			}
			case "model.set": {
				const params = request.params as ModelSetParams;
				const state = getOrCreateState(params.sessionId);
				state.model = params.model;
				reply(ws, request.id, { ok: true });
				return;
			}
			case "model.list": {
				void (async () => {
					const all: ModelInfo[] = [];
					for (const providerId of KNOWN_PROVIDER_IDS) {
						try {
							const { provider } = await resolveProvider(`${providerId}/placeholder`, keyStore);
							all.push(...(await provider.listModels()));
						} catch {
							// provider unavailable (no key configured, unreachable, etc.) — skip it
						}
					}
					reply(ws, request.id, all);
				})();
				return;
			}
			case "permission.respond": {
				const params = request.params as PermissionRespondParams;
				const pending = pendingPermissions.get(params.requestId);
				if (pending) {
					pending.resolve(params.decision);
					pendingPermissions.delete(params.requestId);
				}
				reply(ws, request.id, { ok: true });
				return;
			}
			case "question.respond": {
				const params = request.params as QuestionRespondParams;
				const pending = pendingQuestions.get(params.questionId);
				if (pending) {
					pending.resolve({ optionId: params.optionId, freeText: params.freeText });
					pendingQuestions.delete(params.questionId);
				}
				reply(ws, request.id, { ok: true });
				return;
			}
			case "config.get": {
				reply(ws, request.id, loadConfig());
				return;
			}
			case "config.set": {
				const params = request.params as ConfigSetParams;
				const merged = ConfigSchema.parse({ ...loadConfig(), ...params.patch });
				saveConfig(merged);
				reply(ws, request.id, { ok: true });
				return;
			}
			case "provider.addKey": {
				const params = request.params as ProviderAddKeyParams;
				void keyStore.set(params.provider, params.key).then(() => reply(ws, request.id, { ok: true }));
				return;
			}
			case "mcp.list": {
				const result: McpListResult = mcpRegistry.list().map(
					(handle): McpServerInfo => ({
						name: handle.config.name,
						transport: handle.config.transport,
						status: handle.status,
					}),
				);
				reply(ws, request.id, result);
				return;
			}
			case "mcp.connect": {
				const params = request.params as McpConnectParams;
				const serverConfig = loadConfig().mcpServers.find((s) => s.name === params.name);
				if (!serverConfig) {
					replyError(ws, request.id, `unknown mcp server "${params.name}"`, -32602);
					return;
				}
				void mcpRegistry.connectOne(serverConfig).then((attempt) => {
					broadcastMcpStatus(attempt.name, attempt.status, attempt.error);
					reply(ws, request.id, { ok: attempt.ok, status: attempt.status, error: attempt.error });
				});
				return;
			}
			default: {
				replyError(ws, request.id, "Method not found", -32601);
			}
		}
	}

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

	// Fire-and-forget: connecting configured MCP servers must never block/fail daemon startup.
	void connectConfiguredMcpServers();

	return {
		server,
		port: server.port ?? 0,
		token,
		stop: () => {
			server.stop(true);
			void mcpRegistry.disconnectAll();
			const daemonJson = join(otoclawDir(), "daemon.json");
			if (existsSync(daemonJson)) {
				rmSync(daemonJson);
			}
		},
	};
}
