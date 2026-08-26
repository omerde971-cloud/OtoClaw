import { afterAll, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryKeyStore } from "@otoclaw/providers";
import { StubProvider } from "../../agent/test/support/stub-provider";
import { openStore } from "../src/store";
import { startServer } from "../src/server";

/**
 * "Submit and forget": message.send starts runTask() and replies with just a messageId —
 * the caller is not expected to stay connected to see the result. This proves the run keeps
 * going and its outcome lands in sqlite (queryable via task.status) even when the WS
 * connection that sent message.send is closed well before the run finishes, and that a
 * completely different, later connection can read the persisted result.
 */

function waitFor<T>(check: () => T | undefined, timeoutMs = 5000, intervalMs = 20): Promise<T> {
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

test("message.send outcome survives the sending client disconnecting, queryable via task.status", async () => {
	const dbPath = join(tmpdir(), `otoclaw-taskstatus-${randomUUID()}.db`);
	const db = openStore(dbPath);
	cleanupFns.push(() => db.close());
	cleanupFns.push(() => existsSync(dbPath) && rmSync(dbPath));

	const cwd = mkdtempSync(join(tmpdir(), "otoclaw-taskstatus-"));
	cleanupFns.push(() => rmSync(cwd, { recursive: true, force: true }));
	// fs.read (unlike fs.write) defaults to "allow" (see DEFAULT_PERMISSION_BY_KEY in
	// packages/agent/src/loop.ts), so this run never needs a permission.request round trip —
	// deliberately, since nobody is connected to answer one for most of this test.
	writeFileSync(join(cwd, "hello.txt"), "hello world");

	const plan = {
		steps: [{ id: "step-1", description: "read hello.txt", kind: "tool", acceptance: ["hello.txt was read"] }],
	};
	const stubProvider = new StubProvider([
		[{ delta: JSON.stringify(plan) }, { done: true }],
		[
			{
				toolCall: {
					id: "call_1",
					name: "fs.read",
					argsDelta: JSON.stringify({ path: "hello.txt" }),
				},
			},
			{ done: true },
		],
		[{ delta: "not valid json, so judge() falls back to its default passable verdict", done: true }],
	]);

	const daemon = startServer(db, {
		keyStore: new MemoryKeyStore(),
		resolveProvider: async () => ({ provider: stubProvider, model: "stub/model", apiKey: null }),
	});
	cleanupFns.push(() => daemon.stop());

	// First connection: create the session, kick off the run, then disconnect immediately —
	// before any tool/pipeline/judge events have had a chance to arrive.
	const ws1 = new WebSocket(`ws://127.0.0.1:${daemon.port}/ws?token=${daemon.token}`);
	const ws1Messages: Array<Record<string, unknown>> = [];
	ws1.onmessage = (ev) => ws1Messages.push(JSON.parse(ev.data as string) as Record<string, unknown>);
	await new Promise<void>((resolve, reject) => {
		ws1.onopen = () => resolve();
		ws1.onerror = () => reject(new Error("ws1 failed to open"));
	});

	ws1.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "session.create", params: { cwd, mode: "auto" } }));
	const sessionResponse = (await waitFor(() => ws1Messages.find((m) => m.id === 1))) as {
		result: { sessionId: string };
	};
	const sessionId = sessionResponse.result.sessionId;

	ws1.send(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "model.set", params: { sessionId, model: "stub/model" } }));
	await waitFor(() => ws1Messages.find((m) => m.id === 2));

	// task.status before any run has been started: "not_found".
	ws1.send(JSON.stringify({ jsonrpc: "2.0", id: 3, method: "task.status", params: { sessionId } }));
	const preRunStatus = (await waitFor(() => ws1Messages.find((m) => m.id === 3))) as {
		result: { status: string; summary: string; verdicts: unknown[] };
	};
	expect(preRunStatus.result.status).toBe("not_found");

	ws1.send(
		JSON.stringify({ jsonrpc: "2.0", id: 4, method: "message.send", params: { sessionId, text: "please write hello.txt for me" } }),
	);
	const sendResponse = (await waitFor(() => ws1Messages.find((m) => m.id === 4))) as {
		result: { messageId: string };
	};
	expect(typeof sendResponse.result.messageId).toBe("string");

	// Disconnect right away — runTask() must keep running on the daemon side regardless.
	ws1.close();
	await waitFor(() => (ws1.readyState === WebSocket.CLOSED ? true : undefined));

	// A second, unrelated connection later polls task.status until the run (which nobody is
	// watching live events for any more) finishes, and reads back a persisted result.
	const ws2 = new WebSocket(`ws://127.0.0.1:${daemon.port}/ws?token=${daemon.token}`);
	const ws2Messages: Array<Record<string, unknown>> = [];
	ws2.onmessage = (ev) => ws2Messages.push(JSON.parse(ev.data as string) as Record<string, unknown>);
	cleanupFns.push(() => ws2.close());
	await new Promise<void>((resolve, reject) => {
		ws2.onopen = () => resolve();
		ws2.onerror = () => reject(new Error("ws2 failed to open"));
	});

	let nextId = 100;
	async function pollTaskStatus(): Promise<{ status: string; summary: string; verdicts: Array<{ label: string }> }> {
		const id = nextId++;
		ws2.send(JSON.stringify({ jsonrpc: "2.0", id, method: "task.status", params: { sessionId } }));
		const response = (await waitFor(() => ws2Messages.find((m) => m.id === id))) as {
			result: { status: string; summary: string; verdicts: Array<{ label: string }> };
		};
		return response.result;
	}

	async function waitForFinalStatus(timeoutMs = 5000, intervalMs = 50): Promise<{ status: string; summary: string; verdicts: Array<{ label: string }> }> {
		const start = Date.now();
		for (;;) {
			const status = await pollTaskStatus();
			if (status.status !== "running") return status;
			if (Date.now() - start > timeoutMs) throw new Error(`task.status still "running" after ${timeoutMs}ms`);
			await new Promise((resolve) => setTimeout(resolve, intervalMs));
		}
	}

	const finalStatus = await waitForFinalStatus();

	expect(finalStatus.status).toBe("done");
	expect(finalStatus.summary.length).toBeGreaterThan(0);
	expect(finalStatus.verdicts.length).toBeGreaterThan(0);
	expect(finalStatus.verdicts.every((v) => v.label === "good" || v.label === "bad")).toBe(true);

	daemon.stop();
	db.close();
	if (existsSync(dbPath)) rmSync(dbPath);
}, 15000);
