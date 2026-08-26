import { afterAll, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DaemonRuntimeInfoSchema } from "@otoclaw/shared";
import { openStore, otoclawDir } from "../src/store";
import { startServer } from "../src/server";

/**
 * Phase 0 smoke test: "a client can connect, create a session, and receive
 * an echo event". Runs the daemon in-process (real Bun.serve + real sqlite
 * store), talks to it over a real WebSocket, and exercises the actual
 * JSON-RPC wire protocol end to end.
 */

function waitFor<T>(check: () => T | undefined, timeoutMs = 2000, intervalMs = 20): Promise<T> {
	const start = Date.now();
	return new Promise((resolve, reject) => {
		const tick = () => {
			const value = check();
			if (value !== undefined) {
				resolve(value);
				return;
			}
			if (Date.now() - start > timeoutMs) {
				reject(new Error(`waitFor timed out after ${timeoutMs}ms`));
				return;
			}
			setTimeout(tick, intervalMs);
		};
		tick();
	});
}

const cleanupFns: Array<() => void> = [];
afterAll(() => {
	for (const fn of cleanupFns.splice(0)) {
		try {
			fn();
		} catch {
			// best-effort cleanup
		}
	}
});

test("client can connect, create a session, and receive an echo event", async () => {
	const dbPath = join(tmpdir(), `otoclaw-smoke-${randomUUID()}.db`);
	const db = openStore(dbPath);
	cleanupFns.push(() => db.close());
	cleanupFns.push(() => {
		if (existsSync(dbPath)) rmSync(dbPath);
	});

	const daemon = startServer(db);
	cleanupFns.push(() => daemon.stop());

	// 1. daemon.json should appear with port/token fields, within 2s.
	const daemonJsonPath = join(otoclawDir(), "daemon.json");
	const runtimeInfo = await waitFor(() => {
		if (!existsSync(daemonJsonPath)) return undefined;
		try {
			return DaemonRuntimeInfoSchema.parse(JSON.parse(readFileSync(daemonJsonPath, "utf8")));
		} catch {
			return undefined;
		}
	});

	expect(runtimeInfo.port).toBe(daemon.port);
	expect(runtimeInfo.token).toBe(daemon.token);
	expect(typeof runtimeInfo.port).toBe("number");
	expect(runtimeInfo.token.length).toBeGreaterThan(0);

	// 2. Connect with the real token.
	const ws = new WebSocket(`ws://127.0.0.1:${daemon.port}/ws?token=${daemon.token}`);
	const messages: unknown[] = [];
	ws.onmessage = (ev) => {
		messages.push(JSON.parse(ev.data as string));
	};
	cleanupFns.push(() => ws.close());

	await new Promise<void>((resolve, reject) => {
		ws.onopen = () => resolve();
		ws.onerror = () => reject(new Error("ws failed to open"));
	});

	// 3. session.create
	ws.send(
		JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "session.create",
			params: { cwd: ".", mode: "manual" },
		}),
	);

	const sessionResponse = (await waitFor(() =>
		messages.find(
			(m): m is { id: number; result?: { sessionId?: string } } =>
				typeof m === "object" && m !== null && (m as { id?: unknown }).id === 1,
		),
	)) as { id: number; result?: { sessionId?: string } };

	expect(sessionResponse.result).toBeDefined();
	const sessionId = sessionResponse.result?.sessionId;
	expect(typeof sessionId).toBe("string");
	expect((sessionId ?? "").length).toBeGreaterThan(0);

	// 4. echo.send -> expect an `echo` notification (no `id` field).
	ws.send(
		JSON.stringify({
			jsonrpc: "2.0",
			id: 2,
			method: "echo.send",
			params: { sessionId, message: "hello-phase0" },
		}),
	);

	const echoNotification = (await waitFor(() =>
		messages.find(
			(m): m is { method: string; params: { sessionId: string; message: string } } =>
				typeof m === "object" &&
				m !== null &&
				!("id" in (m as Record<string, unknown>)) &&
				(m as { method?: unknown }).method === "echo",
		),
	)) as { method: string; params: { sessionId: string; message: string } };

	expect(echoNotification.method).toBe("echo");
	expect(echoNotification.params.message).toBe("hello-phase0");
	expect(echoNotification.params.sessionId).toBe(sessionId);

	// 5. Negative auth test: wrong token must be rejected.
	const badWs = new WebSocket(`ws://127.0.0.1:${daemon.port}/ws?token=not-the-real-token`);
	const badOutcome = await new Promise<"open" | "closed" | "error">((resolve) => {
		badWs.onopen = () => resolve("open");
		badWs.onclose = () => resolve("closed");
		badWs.onerror = () => resolve("error");
	});
	expect(badOutcome).not.toBe("open");
	try {
		badWs.close();
	} catch {
		// already closed
	}

	// 6. Cleanup: close socket, stop daemon, verify daemon.json is gone.
	ws.close();
	await waitFor(() => (ws.readyState === WebSocket.CLOSED ? true : undefined));

	daemon.stop();

	expect(existsSync(daemonJsonPath)).toBe(false);

	db.close();
	if (existsSync(dbPath)) rmSync(dbPath);
});
