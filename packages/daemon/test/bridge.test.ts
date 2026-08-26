import { afterAll, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "../src/store";
import { startServer } from "../src/server";

/**
 * Phase 4a: browser bridge round trip. A "bridge" WS client (standing in for the native
 * messaging host) registers itself, then a normal client's browser.* requests are forwarded
 * to it and its responses are relayed back to the original caller.
 */

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

function openWs(port: string | number, token: string): Promise<{ ws: WebSocket; messages: Array<Record<string, unknown>> }> {
	const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${token}`);
	const messages: Array<Record<string, unknown>> = [];
	ws.onmessage = (ev) => {
		messages.push(JSON.parse(ev.data as string));
	};
	return new Promise((resolve, reject) => {
		ws.onopen = () => resolve({ ws, messages });
		ws.onerror = () => reject(new Error("ws failed to open"));
	});
}

function findResponse(messages: Array<Record<string, unknown>>, id: number): Record<string, unknown> | undefined {
	return messages.find((m) => m.id === id);
}

test("browser.attach reports disconnected until a bridge registers, then attached", async () => {
	const dbPath = join(tmpdir(), `otoclaw-bridge-${randomUUID()}.db`);
	const db = openStore(dbPath);
	cleanupFns.push(() => db.close());
	cleanupFns.push(() => existsSync(dbPath) && rmSync(dbPath));

	const daemon = startServer(db);
	cleanupFns.push(() => daemon.stop());

	const { ws: client, messages: clientMessages } = await openWs(daemon.port, daemon.token);
	cleanupFns.push(() => client.close());

	client.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "browser.attach", params: {} }));
	const before = (await waitFor(() => findResponse(clientMessages, 1))) as { result: { attached: boolean } };
	expect(before.result.attached).toBe(false);

	const { ws: bridge } = await openWs(daemon.port, daemon.token);
	cleanupFns.push(() => bridge.close());
	bridge.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "bridge.register", params: { role: "bridge" } }));

	client.send(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "browser.attach", params: {} }));
	const after = (await waitFor(() => findResponse(clientMessages, 2))) as { result: { attached: boolean } };
	expect(after.result.attached).toBe(true);

	client.send(JSON.stringify({ jsonrpc: "2.0", id: 3, method: "browser.status", params: {} }));
	const status = (await waitFor(() => findResponse(clientMessages, 3))) as { result: { status: string } };
	expect(status.result.status).toBe("connected");
});

test("browser.navigate is forwarded to the bridge and its response relayed back to the caller", async () => {
	const dbPath = join(tmpdir(), `otoclaw-bridge-${randomUUID()}.db`);
	const db = openStore(dbPath);
	cleanupFns.push(() => db.close());
	cleanupFns.push(() => existsSync(dbPath) && rmSync(dbPath));

	const daemon = startServer(db);
	cleanupFns.push(() => daemon.stop());

	const { ws: bridge, messages: bridgeMessages } = await openWs(daemon.port, daemon.token);
	cleanupFns.push(() => bridge.close());
	bridge.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "bridge.register", params: { role: "bridge" } }));
	await waitFor(() => findResponse(bridgeMessages, 1));

	// Act as the bridge: whenever it receives a browser.navigate request, echo back an ok result.
	bridge.onmessage = (ev) => {
		const parsed = JSON.parse(ev.data as string) as { id: number | string; method?: string; params?: unknown };
		bridgeMessages.push(parsed as Record<string, unknown>);
		if (parsed.method === "browser.navigate") {
			bridge.send(JSON.stringify({ jsonrpc: "2.0", id: parsed.id, result: { ok: true } }));
		}
	};

	const { ws: client, messages: clientMessages } = await openWs(daemon.port, daemon.token);
	cleanupFns.push(() => client.close());

	client.send(
		JSON.stringify({
			jsonrpc: "2.0",
			id: 10,
			method: "browser.navigate",
			params: { sessionId: "session-1", url: "https://example.com" },
		}),
	);

	const response = (await waitFor(() => findResponse(clientMessages, 10))) as { result: { ok: boolean } };
	expect(response.result).toEqual({ ok: true });

	const forwarded = (await waitFor(() => bridgeMessages.find((m) => m.method === "browser.navigate"))) as Record<
		string,
		unknown
	>;
	expect((forwarded.params as { url: string }).url).toBe("https://example.com");
});

test("browser.navigate errors when no bridge is connected", async () => {
	const dbPath = join(tmpdir(), `otoclaw-bridge-${randomUUID()}.db`);
	const db = openStore(dbPath);
	cleanupFns.push(() => db.close());
	cleanupFns.push(() => existsSync(dbPath) && rmSync(dbPath));

	const daemon = startServer(db);
	cleanupFns.push(() => daemon.stop());

	const { ws: client, messages: clientMessages } = await openWs(daemon.port, daemon.token);
	cleanupFns.push(() => client.close());

	client.send(
		JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "browser.navigate",
			params: { sessionId: "session-1", url: "https://example.com" },
		}),
	);

	const response = (await waitFor(() => findResponse(clientMessages, 1))) as { error?: { message: string } };
	expect(response.error).toBeDefined();
	expect(response.error?.message).toContain("no browser bridge connected");
});

test("vision.capture writes a frame and returns its id/path (Phase 4d)", async () => {
	// vision.capture() writes under os.homedir()/.otoclaw/cache/vision — point homedir at a
	// scratch dir for this test so it never touches the real user's ~/.otoclaw cache.
	const fakeHome = join(tmpdir(), `otoclaw-bridge-home-${randomUUID()}`);
	const originalUserProfile = process.env.USERPROFILE;
	const originalHome = process.env.HOME;
	process.env.USERPROFILE = fakeHome;
	process.env.HOME = fakeHome;
	cleanupFns.push(() => {
		process.env.USERPROFILE = originalUserProfile;
		process.env.HOME = originalHome;
		existsSync(fakeHome) && rmSync(fakeHome, { recursive: true, force: true });
	});

	const dbPath = join(tmpdir(), `otoclaw-bridge-${randomUUID()}.db`);
	const db = openStore(dbPath);
	cleanupFns.push(() => db.close());
	cleanupFns.push(() => existsSync(dbPath) && rmSync(dbPath));

	const daemon = startServer(db);
	cleanupFns.push(() => daemon.stop());

	const { ws: client, messages: clientMessages } = await openWs(daemon.port, daemon.token);
	cleanupFns.push(() => client.close());

	client.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "vision.capture", params: { sessionId: "s1" } }));

	const response = (await waitFor(() => findResponse(clientMessages, 1))) as {
		error?: { message: string };
		result?: { frameId?: string; path?: string };
	};
	expect(response.error).toBeUndefined();
	expect(response.result?.frameId).toBeTruthy();
	expect(response.result?.path).toContain(fakeHome);
});
