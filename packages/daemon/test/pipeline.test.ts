import { afterAll, expect, test } from "bun:test";
import { StubProvider } from "../../agent/test/support/stub-provider";
import { existsSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { MemoryKeyStore } from "@otoclaw/providers";
import { openStore } from "../src/store";
import { startServer } from "../src/server";

function waitFor<T>(check: () => T | undefined, timeoutMs = 3000, intervalMs = 20): Promise<T> {
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

test("end-to-end: session.create -> message.send -> stream/pipeline/tool/mascot events", async () => {
	const dbPath = join(tmpdir(), `otoclaw-pipeline-${randomUUID()}.db`);
	const db = openStore(dbPath);
	cleanupFns.push(() => db.close());
	cleanupFns.push(() => existsSync(dbPath) && rmSync(dbPath));

	const cwd = mkdtempSync(join(tmpdir(), "otoclaw-pipeline-"));
	cleanupFns.push(() => rmSync(cwd, { recursive: true, force: true }));

	const plan = {
		steps: [{ id: "step-1", description: "write hello.txt", kind: "tool", acceptance: ["hello.txt exists"] }],
	};
	const stubProvider = new StubProvider([
		[{ delta: JSON.stringify(plan) }, { done: true }],
		[
			{
				toolCall: {
					id: "call_1",
					name: "fs.write",
					argsDelta: JSON.stringify({ path: "hello.txt", content: "hello world" }),
				},
			},
			{ done: true },
		],
		[{ delta: "done", done: true }],
	]);

	const daemon = startServer(db, {
		keyStore: new MemoryKeyStore(),
		resolveProvider: async () => ({ provider: stubProvider, model: "stub/model", apiKey: null }),
	});
	cleanupFns.push(() => daemon.stop());

	const ws = new WebSocket(`ws://127.0.0.1:${daemon.port}/ws?token=${daemon.token}`);
	const messages: Array<Record<string, unknown>> = [];
	ws.onmessage = (ev) => {
		const parsed = JSON.parse(ev.data as string) as Record<string, unknown>;
		messages.push(parsed);
		if (parsed.method === "permission.request") {
			const requestId = (parsed.params as { requestId: string }).requestId;
			ws.send(
				JSON.stringify({ jsonrpc: "2.0", id: 99, method: "permission.respond", params: { requestId, decision: "allow" } }),
			);
		}
	};
	cleanupFns.push(() => ws.close());

	await new Promise<void>((resolve, reject) => {
		ws.onopen = () => resolve();
		ws.onerror = () => reject(new Error("ws failed to open"));
	});

	ws.send(
		JSON.stringify({ jsonrpc: "2.0", id: 1, method: "session.create", params: { cwd, mode: "auto" } }),
	);
	const sessionResponse = (await waitFor(() =>
		messages.find((m) => m.id === 1),
	)) as { result: { sessionId: string } };
	const sessionId = sessionResponse.result.sessionId;
	expect(typeof sessionId).toBe("string");

	ws.send(
		JSON.stringify({ jsonrpc: "2.0", id: 2, method: "model.set", params: { sessionId, model: "stub/model" } }),
	);
	await waitFor(() => messages.find((m) => m.id === 2));

	ws.send(
		JSON.stringify({ jsonrpc: "2.0", id: 3, method: "message.send", params: { sessionId, text: "please write hello.txt for me" } }),
	);
	const sendResponse = (await waitFor(() => messages.find((m) => m.id === 3))) as {
		result: { messageId: string };
	};
	expect(typeof sendResponse.result.messageId).toBe("string");

	await waitFor(() =>
		messages.find((m) => m.method === "tool.end" && (m.params as { name?: string }).name === "fs.write"),
	);

	const notifications = messages.filter((m) => !("id" in m));

	const stageOrder = notifications
		.filter((m) => m.method === "pipeline.stage")
		.map((m) => (m.params as { stage: string }).stage);
	expect(stageOrder).toEqual(["intake", "plan", "route", "execute", "review", "deliver"]);

	expect(notifications.some((m) => m.method === "stream.delta")).toBe(true);

	const toolStart = notifications.find((m) => m.method === "tool.start");
	expect(toolStart).toBeDefined();
	expect((toolStart as Record<string, unknown>).params).toMatchObject({ name: "fs.write" });

	const toolEnd = notifications.find((m) => m.method === "tool.end");
	expect(toolEnd).toBeDefined();

	const mascotStates = notifications
		.filter((m) => m.method === "mascot.state")
		.map((m) => (m.params as { state: string }).state);
	expect(mascotStates).toContain("thinking");
	expect(mascotStates).toContain("coding");
	expect(mascotStates.indexOf("thinking")).toBeLessThan(mascotStates.indexOf("coding"));

	expect(existsSync(join(cwd, "hello.txt"))).toBe(true);

	ws.close();
	daemon.stop();
	db.close();
	if (existsSync(dbPath)) rmSync(dbPath);
});
