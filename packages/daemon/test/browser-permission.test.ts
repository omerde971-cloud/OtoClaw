import { afterAll, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { openStore } from "../src/store";
import { startServer } from "../src/server";

/**
 * Phase 4+: browser.act is a raw RPC (not routed through the agent loop's tool-call permission
 * check in packages/agent/src/loop.ts), so it needs its own gate straight in server.ts before
 * forwarding to the bridge. These tests cover that gate: Manual mode always asks, Auto mode
 * follows the "browser" permission key's resolved policy (session > project > global config >
 * per-action default), and gmailSendDraft/calendarSaveEvent carry a higher risk score than
 * gmailReadInbox/gmailComposeDraft.
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

interface Harness {
	db: ReturnType<typeof openStore>;
	daemon: ReturnType<typeof startServer>;
	client: WebSocket;
	clientMessages: Array<Record<string, unknown>>;
	bridge: WebSocket;
	bridgeMessages: Array<Record<string, unknown>>;
}

async function setup(): Promise<Harness> {
	const dbPath = join(tmpdir(), `otoclaw-browser-perm-${randomUUID()}.db`);
	const db = openStore(dbPath);
	cleanupFns.push(() => db.close());
	cleanupFns.push(() => existsSync(dbPath) && rmSync(dbPath));

	const daemon = startServer(db);
	cleanupFns.push(() => daemon.stop());

	const { ws: bridge, messages: bridgeMessages } = await openWs(daemon.port, daemon.token);
	cleanupFns.push(() => bridge.close());
	bridge.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "bridge.register", params: { role: "bridge" } }));
	await waitFor(() => findResponse(bridgeMessages, 1));

	// Act as the bridge: echo ok:true for every forwarded browser.act.
	bridge.onmessage = (ev) => {
		const parsed = JSON.parse(ev.data as string) as { id: number | string; method?: string; params?: unknown };
		bridgeMessages.push(parsed as Record<string, unknown>);
		if (parsed.method === "browser.act") {
			bridge.send(JSON.stringify({ jsonrpc: "2.0", id: parsed.id, result: { ok: true } }));
		}
	};

	const { ws: client, messages: clientMessages } = await openWs(daemon.port, daemon.token);
	cleanupFns.push(() => client.close());

	return { db, daemon, client, clientMessages, bridge, bridgeMessages };
}

async function createSession(h: Harness, id: number, mode: "manual" | "auto"): Promise<string> {
	const cwd = mkdtempSync(join(tmpdir(), "otoclaw-browser-perm-"));
	cleanupFns.push(() => rmSync(cwd, { recursive: true, force: true }));
	h.client.send(JSON.stringify({ jsonrpc: "2.0", id, method: "session.create", params: { cwd, mode } }));
	const response = (await waitFor(() => findResponse(h.clientMessages, id))) as { result: { sessionId: string } };
	return response.result.sessionId;
}

test("manual mode: gmailSendDraft always triggers permission.request, even after answering allow once", async () => {
	const h = await setup();
	const sessionId = await createSession(h, 1, "manual");

	h.client.send(
		JSON.stringify({
			jsonrpc: "2.0",
			id: 2,
			method: "browser.act",
			params: { sessionId, action: { type: "gmailSendDraft" } },
		}),
	);

	const permissionRequest = (await waitFor(() =>
		h.clientMessages.find((m) => m.method === "permission.request"),
	)) as { params: { requestId: string; risk: { score: number } } };
	expect(permissionRequest.params.risk.score).toBe(70);

	// "always" would normally set a session override that lets a later "browser.act.gmailSendDraft"
	// through without asking (see DaemonPermissionChannel) — but manual mode short-circuits to
	// "ask" before ever consulting session overrides, so it must still ask the second time too.
	h.client.send(
		JSON.stringify({
			jsonrpc: "2.0",
			id: 99,
			method: "permission.respond",
			params: { requestId: permissionRequest.params.requestId, decision: "always" },
		}),
	);

	const actResponse = (await waitFor(() => findResponse(h.clientMessages, 2))) as { result: { ok: boolean } };
	expect(actResponse.result.ok).toBe(true);

	h.client.send(
		JSON.stringify({
			jsonrpc: "2.0",
			id: 3,
			method: "browser.act",
			params: { sessionId, action: { type: "gmailSendDraft" } },
		}),
	);

	const secondPermissionRequest = await waitFor(() =>
		h.clientMessages.find((m, i) => m.method === "permission.request" && i > h.clientMessages.indexOf(permissionRequest as unknown as Record<string, unknown>)),
	);
	expect(secondPermissionRequest).toBeDefined();

	h.client.send(
		JSON.stringify({
			jsonrpc: "2.0",
			id: 100,
			method: "permission.respond",
			params: { requestId: (secondPermissionRequest as { params: { requestId: string } }).params.requestId, decision: "allow" },
		}),
	);
	const secondActResponse = (await waitFor(() => findResponse(h.clientMessages, 3))) as { result: { ok: boolean } };
	expect(secondActResponse.result.ok).toBe(true);
});

test("auto mode: gmailSendDraft asks by default (browser policy default is ask)", async () => {
	const h = await setup();
	const sessionId = await createSession(h, 1, "auto");

	h.client.send(
		JSON.stringify({
			jsonrpc: "2.0",
			id: 2,
			method: "browser.act",
			params: { sessionId, action: { type: "gmailSendDraft" } },
		}),
	);

	const permissionRequest = (await waitFor(() =>
		h.clientMessages.find((m) => m.method === "permission.request"),
	)) as { params: { requestId: string; risk: { score: number } } };
	expect(permissionRequest.params.risk.score).toBe(70);

	h.client.send(
		JSON.stringify({
			jsonrpc: "2.0",
			id: 99,
			method: "permission.respond",
			params: { requestId: permissionRequest.params.requestId, decision: "deny" },
		}),
	);

	const actResponse = (await waitFor(() => findResponse(h.clientMessages, 2))) as { error?: { message: string } };
	expect(actResponse.error).toBeDefined();
	expect(actResponse.error?.message).toContain("permission denied");
});

test("auto mode: gmailSendDraft proceeds without asking once browser policy is set to always in global config", async () => {
	// config.set persists to ~/.otoclaw/config.json via otoclawDir()/homedir() — point homedir
	// at a scratch dir for this test so it never touches the real user's config.
	const fakeHome = join(tmpdir(), `otoclaw-browser-perm-home-${randomUUID()}`);
	const originalUserProfile = process.env.USERPROFILE;
	const originalHome = process.env.HOME;
	process.env.USERPROFILE = fakeHome;
	process.env.HOME = fakeHome;
	cleanupFns.push(() => {
		process.env.USERPROFILE = originalUserProfile;
		process.env.HOME = originalHome;
		existsSync(fakeHome) && rmSync(fakeHome, { recursive: true, force: true });
	});

	const h = await setup();

	h.client.send(
		JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "config.set",
			params: { patch: { permissions: { browser: "always" } } },
		}),
	);
	await waitFor(() => findResponse(h.clientMessages, 1));

	const sessionId = await createSession(h, 2, "auto");

	h.client.send(
		JSON.stringify({
			jsonrpc: "2.0",
			id: 3,
			method: "browser.act",
			params: { sessionId, action: { type: "gmailSendDraft" } },
		}),
	);

	const actResponse = (await waitFor(() => findResponse(h.clientMessages, 3))) as { result: { ok: boolean } };
	expect(actResponse.result.ok).toBe(true);
	expect(h.clientMessages.some((m) => m.method === "permission.request")).toBe(false);
});

test("auto mode: gmailComposeDraft (low risk) proceeds silently under the default policy", async () => {
	const h = await setup();
	const sessionId = await createSession(h, 1, "auto");

	h.client.send(
		JSON.stringify({
			jsonrpc: "2.0",
			id: 2,
			method: "browser.act",
			params: { sessionId, action: { type: "gmailComposeDraft", to: "a@b.com", subject: "hi", body: "hello" } },
		}),
	);

	const actResponse = (await waitFor(() => findResponse(h.clientMessages, 2))) as { result: { ok: boolean } };
	expect(actResponse.result.ok).toBe(true);
	expect(h.clientMessages.some((m) => m.method === "permission.request")).toBe(false);

	const forwarded = h.bridgeMessages.find((m) => m.method === "browser.act");
	expect(forwarded).toBeDefined();
	const forwardedParams = (forwarded as Record<string, unknown>).params as { action: { type: string } };
	expect(forwardedParams.action.type).toBe("gmailComposeDraft");
});

test("manual mode: gmailComposeDraft (low risk) still asks, since manual mode always asks", async () => {
	const h = await setup();
	const sessionId = await createSession(h, 1, "manual");

	h.client.send(
		JSON.stringify({
			jsonrpc: "2.0",
			id: 2,
			method: "browser.act",
			params: { sessionId, action: { type: "gmailComposeDraft", to: "a@b.com", subject: "hi", body: "hello" } },
		}),
	);

	const permissionRequest = (await waitFor(() =>
		h.clientMessages.find((m) => m.method === "permission.request"),
	)) as { params: { requestId: string; risk: { score: number } } };
	expect(permissionRequest.params.risk.score).toBe(10);
});
